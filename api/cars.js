export default async function handler(req, res) {
  const { resource = 'info' } = req.query;

  try {
    if (resource === 'info') {
      return await handleCarInfo(req, res);
    }
    if (resource === 'names') {
      return await handleCarNames(req, res);
    }
    if (resource === 'lookup') {
      return await handleCarLookup(req, res);
    }

    return res.status(400).json({ message: 'Unknown resource' });
  } catch (error) {
    console.error('Cars API error:', error);
    return res.status(500).json({ message: error.message || 'Cars API error' });
  }
}

async function handleCarInfo(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sheets, credentials } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const storageClient = await createStorageClient(credentials);

  const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const publicBucket = process.env.GOOGLE_CLOUD_PUBLIC_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!publicBucket) {
    throw new Error('GOOGLE_CLOUD_PUBLIC_BUCKET (or GOOGLE_CLOUD_STORAGE_BUCKET) not set');
  }

  const carsSheetName = await resolveCarsSheetName(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${carsSheetName}!A:J`,
  });

  const rows = response.data.values || [];
  const cars = rows.slice(1)
    .map(row => ({
      season: row[0],
      carnumber: row[1],
      carkey: row[2],
      carname: row[3],
      carversion: row[4],
      carstatus: row[5],
      carimagepath: row[6],
      carthumb256path: row[7],
      carthumb64path: row[8],
      carjsonpath: row[9]
    }))
    .filter(car => String(car.carstatus || '').toLowerCase() === 'approved');

  const bucket = storageClient.bucket(publicBucket);
  const carsWithPreview = await Promise.all(
    cars.map(async (car) => {
      const previewImageData = await downloadImageAsDataUrl(bucket, publicBucket, car.carimagepath);
      const thumb256ImageData = await downloadImageAsDataUrl(bucket, publicBucket, car.carthumb256path);
      const thumb64ImageData = await downloadImageAsDataUrl(bucket, publicBucket, car.carthumb64path);
      return {
        ...car,
        previewImageData,
        thumb256ImageData,
        thumb64ImageData
      };
    })
  );

  return res.status(200).json({
    cars: carsWithPreview,
    carCount: carsWithPreview.length
  });
}

async function handleCarNames(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sheets } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const carsSheetName = await resolveCarsSheetName(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${carsSheetName}!D:D`,
  });

  const rows = response.data.values || [];
  const names = rows.slice(1)
    .map(row => (row[0] || '').trim())
    .filter(Boolean);

  return res.status(200).json({ names, nameCount: names.length });
}

async function handleCarLookup(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { carname, carkey } = req.query;
  if (!carname || !carkey) {
    return res.status(400).json({ message: 'Missing carname or carkey' });
  }

  const normalizedKey = normalizeCarKey(carkey);
  if (!normalizedKey) {
    return res.status(400).json({ message: 'Invalid car key' });
  }

  const { sheets, credentials } = await createSheets([
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/devstorage.read_only'
  ]);
  const storageClient = await createStorageClient(credentials);

  const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const publicBucket = process.env.GOOGLE_CLOUD_PUBLIC_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const privateBucket = process.env.GOOGLE_CLOUD_PRIVATE_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!publicBucket) {
    throw new Error('GOOGLE_CLOUD_PUBLIC_BUCKET (or GOOGLE_CLOUD_STORAGE_BUCKET) not set');
  }
  if (!privateBucket) {
    throw new Error('GOOGLE_CLOUD_PRIVATE_BUCKET (or GOOGLE_CLOUD_STORAGE_BUCKET) not set');
  }

  const carsSheetName = await resolveCarsSheetName(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${carsSheetName}!A:J`
  });

  const rows = response.data.values || [];
  const match = rows.slice(1).find(row => {
    const rowKey = normalizeCarKey(row[2]);
    const rowName = String(row[3] || '').trim().toLowerCase();
    if (!rowKey || !rowName) return false;
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
    carthumb256path: match[7],
    carthumb64path: match[8],
    carjsonpath: match[9]
  };

  const jsonUrl = new URL(car.carjsonpath);
  let jsonFilePath = jsonUrl.pathname.startsWith('/') ? jsonUrl.pathname.slice(1) : jsonUrl.pathname;
  if (jsonFilePath.startsWith(`${privateBucket}/`)) {
    jsonFilePath = jsonFilePath.slice(privateBucket.length + 1);
  }

  const privateStorageBucket = storageClient.bucket(privateBucket);
  const publicStorageBucket = storageClient.bucket(publicBucket);
  const jsonFileObj = privateStorageBucket.file(jsonFilePath);
  const [jsonContents] = await jsonFileObj.download();
  const jsonText = jsonContents.toString('utf8');
  const carData = JSON.parse(jsonText);

  const bodyImagePath = carData?.imagePaths?.body || car.carimagepath;
  const wheelImagePath = carData?.imagePaths?.wheel;
  const thumb256Path = carData?.imagePaths?.thumb256 || car.carthumb256path;
  const thumb64Path = carData?.imagePaths?.thumb64 || car.carthumb64path;

  const [bodyImageData, wheelImageData, thumb256ImageData, thumb64ImageData] = await Promise.all([
    downloadImageAsDataUrl(publicStorageBucket, publicBucket, bodyImagePath),
    downloadImageAsDataUrl(publicStorageBucket, publicBucket, wheelImagePath),
    downloadImageAsDataUrl(publicStorageBucket, publicBucket, thumb256Path),
    downloadImageAsDataUrl(publicStorageBucket, publicBucket, thumb64Path)
  ]);

  return res.status(200).json({
    car,
    carData,
    assets: {
      bodyImageData,
      wheelImageData,
      thumb256ImageData,
      thumb64ImageData
    }
  });
}

function normalizeCarKey(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}

async function createSheets(scopes) {
  const credentials = getCredentials();
  const { JWT } = await import('google-auth-library');
  const { google } = await import('googleapis');
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, credentials };
}

async function createStorageClient(credentials) {
  const { Storage } = await import('@google-cloud/storage');
  return new Storage({
    credentials,
    projectId: credentials.project_id
  });
}

function getCredentials() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  }

  try {
    return JSON.parse(serviceAccountKey);
  } catch (parseError) {
    try {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (base64Error) {
      throw new Error(`Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: ${parseError.message}. Also tried base64 decoding: ${base64Error.message}`);
    }
  }
}

async function resolveCarsSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-cars', 'Sheet1', 'Cars', 'cars'];
  for (const name of candidateNames) {
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${name}!A1:J1`
      });
      return name;
    } catch (error) {
      // Try next candidate
    }
  }

  throw new Error('Unable to locate cars sheet (tried rapidracers-cars, Sheet1, Cars, cars)');
}

async function downloadImageAsDataUrl(bucket, bucketName, url) {
  if (!url) return null;
  try {
    const filePath = parseBucketPath(bucketName, url);
    const [contents] = await bucket.file(filePath).download();
    const base64 = contents.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.warn('Failed to download image from GCS:', url, error.message);
    return null;
  }
}

function parseBucketPath(bucketName, url) {
  const parsed = new URL(url);
  let path = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  if (path.startsWith(`${bucketName}/`)) {
    path = path.slice(bucketName.length + 1);
  }
  return path;
}