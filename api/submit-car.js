// Temporarily disabled Google APIs for debugging

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

    // For debugging - try a simpler approach
    // Temporarily disable Google APIs and just log success
    console.log('Submission received for:', email, carName);
    return res.status(200).json({ message: 'Submission successful (debug mode)' });

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
