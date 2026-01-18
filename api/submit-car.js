// Use dynamic imports to avoid authentication issues on module load
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Disable Application Default Credentials to prevent auto-loading
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '';

  try {
    if (!req.body || !req.body.carData) {
      console.error('Request body missing carData:', req.body);
      return res.status(400).json({ message: 'Missing carData' });
    }

    const {
      carName,
      teamName,
      email,
      acceleration,
      topSpeed,
      wheelPositions,
      bodyImageData,
      wheelImageData
    } = req.body.carData;

    if (!email || !bodyImageData || !wheelImageData) {
      console.error('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Dynamically import Google APIs to avoid auth issues on module load
    const { google } = await import('googleapis');
    const { Storage } = await import('@google-cloud/storage');

    // Authenticate with Google
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    let credentials;
    try {
      // Try parsing as plain JSON first
      credentials = JSON.parse(serviceAccountKey);
    } catch (parseError) {
      try {
        // If that fails, try decoding from base64
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
      } catch (base64Error) {
        throw new Error(`Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: ${parseError.message}. Also tried base64 decoding: ${base64Error.message}`);
      }
    }

    // Validate credentials object
    if (!credentials.type || credentials.type !== 'service_account') {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not a valid service account key (missing or wrong type)');
    }
    if (!credentials.project_id) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing project_id');
    }
    if (!credentials.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing private_key');
    }
    if (!credentials.client_email) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email');
    }

    // Use JWT auth directly to avoid ADC issues
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/devstorage.full_control']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const storage = google.storage({ version: 'v1', auth });

    // Create separate auth for @google-cloud/storage signed URLs
    const storageAuth = new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    });

    // Hardcoded for now - can be made configurable
    const season = 'season1';
    const race = 'race1';
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set');
    }

    // Create folder-like structure in GCS (using prefixes)
    const basePath = `${season}/${race}/${email}/`;

    // Upload files
    const jsonData = JSON.stringify({
      carName,
      teamName,
      email,
      acceleration,
      topSpeed,
      wheelPositions
    }, null, 2);

    const jsonFileName = `${basePath}car.json`;
    const bodyFileName = `${basePath}body.png`;
    const wheelFileName = `${basePath}wheel.png`;

    await uploadToGCS(storage, bucketName, jsonFileName, Buffer.from(jsonData), 'application/json');
    await uploadToGCS(storage, bucketName, bodyFileName, Buffer.from(bodyImageData.split('base64,')[1], 'base64'), 'image/png');
    await uploadToGCS(storage, bucketName, wheelFileName, Buffer.from(wheelImageData.split('base64,')[1], 'base64'), 'image/png');

    // Generate signed URLs for secure access (valid for 1 year)
    const jsonSignedUrl = await generateSignedUrl(storageAuth, bucketName, jsonFileName);
    const bodySignedUrl = await generateSignedUrl(storageAuth, bucketName, bodyFileName);
    const wheelSignedUrl = await generateSignedUrl(storageAuth, bucketName, wheelFileName);

    // Update spreadsheet with signed URLs
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable not set');
    }

    await appendToSheet(sheets, spreadsheetId, [
      season,
      race,
      email,
      teamName,
      carName,
      bodySignedUrl,
      wheelSignedUrl,
      jsonSignedUrl
    ]);

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: `Submission failed: ${err.message}` });
  }
}

async function uploadToGCS(storage, bucketName, fileName, buffer, contentType) {
  const request = {
    bucket: bucketName,
    name: fileName,
    media: {
      mimeType: contentType,
      body: buffer
    }
  };

  await storage.objects.insert(request);
}

async function generateSignedUrl(storageAuth, bucketName, fileName) {
  const bucket = storageAuth.bucket(bucketName);
  const file = bucket.file(fileName);

  // Generate signed URL valid for 1 year
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  });

  return url;
}

async function makeFilePublic(storage, bucketName, fileName) {
  const request = {
    bucket: bucketName,
    object: fileName,
    resource: {
      entity: 'allUsers',
      role: 'READER'
    }
  };

  await storage.objectAccessControls.insert(request);
}

async function appendToSheet(sheets, spreadsheetId, values) {
  const range = 'Sheet1!A:H'; // Assuming columns A to H

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: {
      values: [values]
    }
  });
}
