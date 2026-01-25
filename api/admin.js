import { requireAdminAuth } from '../lib/admin-auth.js';
import { createGoogleServices } from '../lib/google-auth.js';

export default async function handler(req, res) {
  if (!requireAdminAuth(req, res)) return;

  const { resource } = req.query;

  try {
    if (resource === 'cars') {
      return await handleAdminCars(req, res);
    }
    if (resource === 'car-status') {
      return await handleCarStatus(req, res);
    }
    if (resource === 'races') {
      return await handleAdminRaces(req, res);
    }
    if (resource === 'race-image') {
      return await handleRaceImage(req, res);
    }

    return res.status(400).json({ message: 'Unknown admin resource' });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ message: error.message || 'Admin API error' });
  }
}

async function handleAdminCars(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sheets, credentials } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const storageClient = await createStorageClient(credentials);
  const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
  }

  const sheetName = await resolveCarsSheetName(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:J`,
  });

  const rows = response.data.values || [];
  const cars = rows.slice(1).map((row, index) => ({
    rowIndex: index + 2,
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
  }));

  const bucket = storageClient.bucket(bucketName);
  const carsWithPreview = await Promise.all(
    cars.map(async (car) => {
      const previewImageData = await downloadImageAsDataUrl(bucket, bucketName, car.carimagepath);
      const thumb256ImageData = await downloadImageAsDataUrl(bucket, bucketName, car.carthumb256path);
      const thumb64ImageData = await downloadImageAsDataUrl(bucket, bucketName, car.carthumb64path);
      return {
        ...car,
        previewImageData,
        thumb256ImageData,
        thumb64ImageData
      };
    })
  );

  return res.status(200).json({ cars: carsWithPreview });
}

async function handleCarStatus(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { rowIndex, status } = req.body || {};
  if (!rowIndex || !status) {
    return res.status(400).json({ message: 'Missing rowIndex or status' });
  }

  const { sheets } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const sheetName = await resolveCarsSheetName(sheets, spreadsheetId);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!F${rowIndex}:F${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[String(status)]]
    }
  });

  return res.status(200).json({ message: 'Status updated' });
}

async function handleAdminRaces(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sheets } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
  }

  const sheetName = await resolveRaceSheetName(sheets, spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:H`,
  });

  const rows = response.data.values || [];
  const races = rows.slice(1).map((row, index) => ({
    rowIndex: index + 2,
    season: row[0],
    racenumber: row[1],
    racename: row[2],
    racedeadline: row[3],
    racestart: row[4],
    racedescription: row[5],
    raceimage: row[6],
    racestatus: row[7]
  }));

  return res.status(200).json({ races });
}

async function handleRaceImage(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber, imageData } = req.body || {};
  if (!season || !racenumber || !imageData) {
    return res.status(400).json({ message: 'Missing season, racenumber, or imageData' });
  }

  const { sheets, storageClient } = await createGoogleServices([
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/devstorage.read_write'
  ]);

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
  }

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
  }

  const sheetName = await resolveRaceSheetName(sheets, spreadsheetId);
  const rowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:H`
  });

  const rows = rowsResponse.data.values || [];
  const rowIndex = rows.findIndex((row, idx) => idx > 0
    && String(row[0]) === String(season)
    && String(row[1]) === String(racenumber));

  if (rowIndex < 1) {
    return res.status(404).json({ message: 'Race not found' });
  }

  const filename = `race-${racenumber}-${Date.now()}.png`;
  const objectPath = `races/${season}/${racenumber}/${filename}`;
  const buffer = Buffer.from(imageData.split('base64,')[1], 'base64');

  const bucket = storageClient.bucket(bucketName);
  await bucket.file(objectPath).save(buffer, { contentType: 'image/png' });

  const imageUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!G${rowIndex + 1}:G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[imageUrl]]
    }
  });

  return res.status(200).json({ message: 'Race image updated', imageUrl });
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
    console.warn('Failed to download preview image:', url, error.message);
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

async function resolveRaceSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-race-info', 'Sheet1', 'Races', 'races', 'RaceInfo'];
  for (const name of candidateNames) {
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${name}!A1:H1`
      });
      return name;
    } catch (error) {
      // Try next candidate
    }
  }

  throw new Error('Unable to locate race info sheet (tried rapidracers-race-info, Sheet1, Races, races, RaceInfo)');
}