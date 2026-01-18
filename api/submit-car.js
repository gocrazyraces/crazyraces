// Use dynamic imports to avoid authentication issues on module load
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

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
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/spreadsheets']
    });

    // Test authentication
    try {
      const authClient = await auth.getClient();
      const projectId = await auth.getProjectId();
      console.log('Authentication successful, project ID:', projectId);
    } catch (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    const storage = new Storage({ auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // Hardcoded for now - can be made configurable
    const season = 'season1';
    const race = 'race1';
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set');
    }

    const bucket = storage.bucket(bucketName);

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

    await uploadToGCS(bucket, jsonFileName, Buffer.from(jsonData), 'application/json');
    await uploadToGCS(bucket, bodyFileName, Buffer.from(bodyImageData.split('base64,')[1], 'base64'), 'image/png');
    await uploadToGCS(bucket, wheelFileName, Buffer.from(wheelImageData.split('base64,')[1], 'base64'), 'image/png');

    // Make files public
    await bucket.file(jsonFileName).makePublic();
    await bucket.file(bodyFileName).makePublic();
    await bucket.file(wheelFileName).makePublic();

    // Update spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    await appendToSheet(sheets, spreadsheetId, [
      season,
      race,
      email,
      teamName,
      carName,
      `https://storage.googleapis.com/${bucketName}/${bodyFileName}`,
      `https://storage.googleapis.com/${bucketName}/${wheelFileName}`,
      `https://storage.googleapis.com/${bucketName}/${jsonFileName}`
    ]);

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: `Submission failed: ${err.message}` });
  }
}

async function uploadToGCS(bucket, fileName, buffer, contentType) {
  const file = bucket.file(fileName);
  await file.save(buffer, {
    contentType: contentType,
    public: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
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
