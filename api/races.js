import { createGoogleServices } from '../lib/google-auth.js';
import { getRaceInfo, getAllRaces } from '../lib/race-utils.js';

export default async function handler(req, res) {
  const { resource = 'info' } = req.query;

  try {
    if (resource === 'info') {
      return await handleRaceInfo(req, res);
    }
    if (resource === 'active') {
      return await handleActiveRaces(req, res);
    }
    if (resource === 'entries') {
      return await handleRaceEntries(req, res);
    }
    if (resource === 'results') {
      return await handleRaceResults(req, res);
    }
    if (resource === 'assets') {
      return await handleRaceAssets(req, res);
    }

    return res.status(400).json({ message: 'Unknown resource' });
  } catch (error) {
    console.error('Races API error:', error);
    return res.status(500).json({ message: error.message || 'Races API error' });
  }
}

async function handleRaceInfo(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bypassCache } = req.query;
  const raceInfo = await getRaceInfo();

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (bypassCache === 'true') {
    return res.status(200).json({ raceInfo });
  }

  return res.status(200).json({ raceInfo });
}

async function handleActiveRaces(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const races = await getAllRaces();
  const activeRaces = races
    .filter((race) => {
      const status = String(race.racestatus || '').toLowerCase();
      return status === 'active' || status === 'approved';
    })
    .sort((a, b) => new Date(b.racedeadline) - new Date(a.racedeadline));

  return res.status(200).json({ races: activeRaces });
}

async function handleRaceEntries(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;
  if (!season || !racenumber) {
    return res.status(400).json({ message: 'Missing season or racenumber parameters' });
  }

  const { sheets, credentials } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const storageClient = await createStorageClient(credentials);

  const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
  if (!submissionsSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID not set');
  }

  const carsSpreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!carsSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const entriesSheetName = await resolveRaceEntriesSheetName(sheets, submissionsSpreadsheetId);
  const carsSheetName = await resolveCarsSheetName(sheets, carsSpreadsheetId);

  const entriesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: submissionsSpreadsheetId,
    range: `${entriesSheetName}!A:D`,
  });

  const carsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: carsSpreadsheetId,
    range: `${carsSheetName}!A:J`,
  });

  const entryRows = entriesResponse.data.values || [];
  const carRows = carsResponse.data.values || [];
  const carsByNumber = new Map(
    carRows.slice(1).map(row => [String(row[1]), {
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
    }])
  );

  const seasonStr = String(season);
  const racenumberStr = String(racenumber);

  const entries = entryRows.slice(1)
    .filter(row => {
      const rowSeason = String(row[0]);
      const rowRace = String(row[1]);
      const rowStatus = String(row[3]).toLowerCase();
      return rowSeason === seasonStr && rowRace === racenumberStr && rowStatus === 'entered';
    })
    .map(row => {
      const carNumber = String(row[2]);
      const car = carsByNumber.get(carNumber);
      if (!car || String(car.carstatus).toLowerCase() !== 'approved') {
        return null;
      }
      return {
        carNumber,
        carName: car?.carname || 'Unknown Car',
        carImagePath: car?.carimagepath || '',
        carThumb256Path: car?.carthumb256path || '',
        carThumb64Path: car?.carthumb64path || ''
      };
    })
    .filter(Boolean);

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
  }

  const bucket = storageClient.bucket(bucketName);
  const entriesWithImages = await Promise.all(
    entries.map(async (entry) => {
      const thumb64ImageData = await downloadImageAsDataUrl(bucket, bucketName, entry.carThumb64Path);
      const thumb256ImageData = await downloadImageAsDataUrl(bucket, bucketName, entry.carThumb256Path);
      const previewImageData = await downloadImageAsDataUrl(bucket, bucketName, entry.carImagePath);
      return {
        ...entry,
        thumb64ImageData,
        thumb256ImageData,
        previewImageData
      };
    })
  );

  return res.status(200).json({
    season,
    racenumber,
    entries: entriesWithImages,
    entryCount: entriesWithImages.length
  });
}

async function handleRaceResults(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;
  if (!season) {
    return res.status(400).json({ message: 'Missing season parameter' });
  }

  const { sheets } = await createSheets(['https://www.googleapis.com/auth/spreadsheets']);
  const spreadsheetId = process.env.GOOGLE_SHEETS_RESULTS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_RESULTS_SPREADSHEET_ID not set');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A:H',
  });

  const rows = response.data.values || [];
  const results = rows.slice(1)
    .filter(row => {
      const rowSeason = String(row[0]);
      if (racenumber) {
        return rowSeason === String(season) && String(row[1]) === String(racenumber);
      }
      return rowSeason === String(season);
    })
    .map(row => ({
      season: row[0],
      racenumber: row[1],
      position: row[2],
      time: row[3],
      status: row[4],
      carnumber: row[5],
      carname: row[6],
      notes: row[7]
    }))
    .sort((a, b) => {
      const raceCompare = parseInt(a.racenumber) - parseInt(b.racenumber);
      if (raceCompare !== 0) return raceCompare;
      return parseInt(a.position) - parseInt(b.position);
    });

  return res.status(200).json({
    season,
    racenumber: racenumber || null,
    results,
    resultCount: results.length
  });
}

async function handleRaceAssets(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;
  if (!season || !racenumber) {
    return res.status(400).json({ message: 'Missing season or racenumber parameters' });
  }

  const { sheets, storageClient: storage } = await createGoogleServices([
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/cloud-platform'
  ]);

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
  }

  const raceInfoSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!raceInfoSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
  }

  const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
  if (!submissionsSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID not set');
  }

  const carsSpreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
  if (!carsSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
  }

  const raceSheetName = await resolveRaceSheetName(sheets, raceInfoSpreadsheetId);
  const entriesSheetName = await resolveRaceEntriesSheetName(sheets, submissionsSpreadsheetId);
  const carsSheetName = await resolveCarsSheetName(sheets, carsSpreadsheetId);

  const raceInfoResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: raceInfoSpreadsheetId,
    range: `${raceSheetName}!A:H`,
  });

  const raceRows = raceInfoResponse.data.values || [];
  const raceData = raceRows.slice(1).find(row => {
    const rowSeason = String(row[0]);
    const rowRace = String(row[1]);
    return rowSeason === String(season) && rowRace === String(racenumber);
  });

  if (!raceData) {
    return res.status(404).json({ message: 'Race not found' });
  }

  const raceInfo = {
    season: raceData[0],
    racenumber: raceData[1],
    racename: raceData[2],
    racedeadline: raceData[3],
    racestart: raceData[4],
    racedescription: raceData[5],
    raceimage: raceData[6],
    racestatus: raceData[7]
  };

  const entriesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: submissionsSpreadsheetId,
    range: `${entriesSheetName}!A:D`,
  });

  const carsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: carsSpreadsheetId,
    range: `${carsSheetName}!A:J`,
  });

  const entryRows = entriesResponse.data.values || [];
  const carRows = carsResponse.data.values || [];
  const carsByNumber = new Map(
    carRows.slice(1).map(row => [String(row[1]), {
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
    }])
  );

  const approvedEntries = entryRows.slice(1)
    .filter(row => {
      const rowSeason = String(row[0]);
      const rowRace = String(row[1]);
      const rowStatus = String(row[3]).toLowerCase();
      return rowSeason === String(season) && rowRace === String(racenumber) && rowStatus === 'entered';
    })
    .map(row => {
      const carNumber = String(row[2]);
      const car = carsByNumber.get(carNumber);
      if (!car || String(car.carstatus).toLowerCase() !== 'approved') {
        return null;
      }
      return {
        season: row[0],
        racenumber: row[1],
        carnumber: carNumber,
        racerstatus: row[3],
        carname: car?.carname || '',
        carimagepath: car?.carimagepath || '',
        carthumb256path: car?.carthumb256path || '',
        carthumb64path: car?.carthumb64path || '',
        carjsonpath: car?.carjsonpath || ''
      };
    })
    .filter(Boolean);

  if (approvedEntries.length === 0) {
    return res.status(404).json({ message: 'No approved entries found for this race' });
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folderName = `race-assets-season-${season}-racenumber-${racenumber}`;
  zip.file(`${folderName}/race-info.json`, JSON.stringify(raceInfo, null, 2));

  for (const entry of approvedEntries) {
    const carFolder = `${folderName}/car-${entry.carnumber}`;

    const entryData = {
      season: entry.season,
      racenumber: entry.racenumber,
      carnumber: entry.carnumber,
      carname: entry.carname,
      entrystatus: entry.racerstatus
    };
    zip.file(`${carFolder}/entry.json`, JSON.stringify(entryData, null, 2));

    let carData = null;
    try {
      const jsonUrl = new URL(entry.carjsonpath);
      let jsonFilePath = jsonUrl.pathname.startsWith('/') ? jsonUrl.pathname.slice(1) : jsonUrl.pathname;
      if (jsonFilePath.startsWith(`${bucketName}/`)) {
        jsonFilePath = jsonFilePath.slice(bucketName.length + 1);
      }

      const bucket = storage.bucket(bucketName);
      const jsonFileObj = bucket.file(jsonFilePath);
      const [jsonContents] = await jsonFileObj.download();
      const jsonText = jsonContents.toString('utf8');
      carData = JSON.parse(jsonText);
      zip.file(`${carFolder}/car.json`, jsonText);
    } catch (error) {
      console.error(`Failed to download car.json for ${entry.carnumber}:`, error);
      continue;
    }

    const filesToDownload = [
      { gcsPath: entry.carimagepath, localName: 'preview.png', isText: false },
      { gcsPath: entry.carthumb256path, localName: 'thumb256.png', isText: false },
      { gcsPath: entry.carthumb64path, localName: 'thumb64.png', isText: false },
      { gcsPath: carData.imagePaths.body, localName: 'body.png', isText: false },
      { gcsPath: carData.imagePaths.wheel, localName: 'wheel.png', isText: false }
    ];

    for (const file of filesToDownload) {
      try {
        const url = new URL(file.gcsPath);
        let filePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

        if (filePath.startsWith(`${bucketName}/`)) {
          filePath = filePath.slice(bucketName.length + 1);
        }

        const bucket = storage.bucket(bucketName);
        const fileObj = bucket.file(filePath);
        const [buffer] = await fileObj.download();
        zip.file(`${carFolder}/${file.localName}`, buffer);
      } catch (error) {
        console.error(`Failed to download ${file.gcsPath}:`, error);
      }
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const fileName = `race-assets-season-${season}-racenumber-${racenumber}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  res.send(zipBuffer);
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

async function resolveRaceSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-race-info', 'Sheet1', 'Races', 'races', 'RaceInfo'];
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

  throw new Error('Unable to locate race info sheet (tried rapidracers-race-info, Sheet1, Races, races, RaceInfo)');
}

async function resolveRaceEntriesSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-race-entries', 'Sheet1', 'RaceEntries', 'race-entries'];
  for (const name of candidateNames) {
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${name}!A1:D1`
      });
      return name;
    } catch (error) {
      // Try next candidate
    }
  }

  throw new Error('Unable to locate race entries sheet (tried rapidracers-race-entries, Sheet1, RaceEntries, race-entries)');
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