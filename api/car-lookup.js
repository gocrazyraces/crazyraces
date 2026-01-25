// API endpoint to retrieve a car by name + key (loads car.json + assets)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { carname, carkey } = req.query;
  if (!carname || !carkey) {
    return res.status(400).json({ message: 'Missing carname or carkey' });
  }

  try {
    const normalizedKey = normalizeCarKey(carkey);
    if (!normalizedKey) {
      return res.status(400).json({ message: 'Invalid car key' });
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    }

    const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));
    const { JWT } = await import('google-auth-library');
    const { google } = await import('googleapis');
    const { Storage } = await import('@google-cloud/storage');

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/devstorage.read_only']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const storageClient = new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    });

    const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
    }

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'rapidracers-cars!A:H'
    });

    const rows = response.data.values || [];
    const match = rows.slice(1).find(row => {
      const rowKey = normalizeCarKey(row[2]);
      const rowName = String(row[3] || '').trim().toLowerCase();
      return rowKey === normalizedKey && rowName === String(carname).trim().toLowerCase();
    });

    if (!match) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const car = {
      season: match[0],
      carnumber: match[1],
      carkey: match[2],
      carname: match[3],
      carversion: match[4],
      carstatus: match[5],
      carimagepath: match[6],
      carjsonpath: match[7]
    };

    const jsonUrl = new URL(car.carjsonpath);
    let jsonFilePath = jsonUrl.pathname.startsWith('/') ? jsonUrl.pathname.slice(1) : jsonUrl.pathname;
    if (jsonFilePath.startsWith(`${bucketName}/`)) {
      jsonFilePath = jsonFilePath.slice(bucketName.length + 1);
    }

    const bucket = storageClient.bucket(bucketName);
    const jsonFileObj = bucket.file(jsonFilePath);
    const [jsonContents] = await jsonFileObj.download();
    const jsonText = jsonContents.toString('utf8');
    const carData = JSON.parse(jsonText);

    return res.status(200).json({
      car,
      carData
    });
  } catch (error) {
    console.error('Error fetching car lookup:', error);
    return res.status(500).json({ message: `Failed to fetch car: ${error.message}` });
  }
}

function normalizeCarKey(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}