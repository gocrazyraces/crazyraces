// Use dynamic imports to avoid authentication issues on module load

// ============================
// RACE INFO API (shared)
// ============================
export { getRaceInfo, validateActiveRace } from '../lib/race-utils.js';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Extract season and race from request body
  const { carData } = req.body;
  if (!carData || !carData.season || !carData.race) {
    return res.status(400).json({ message: 'Missing season or race in carData' });
  }

  const { season, race } = carData;

  try {
    // Validate that the season/race corresponds to an active race
    const { validateActiveRace } = await import('../lib/race-utils.js');
    const validation = await validateActiveRace(season, race);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    console.log(`Entry validation passed for Season ${season}, Race ${race}`);

    // Now proceed with the submission
    if (!req.body || !req.body.carData) {
      console.error('Request body missing carData:', req.body);
      return res.status(400).json({ message: 'Missing carData' });
    }

    const {
      carNumber,
      carKey
    } = carData;

    const normalizedCarKey = normalizeCarKey(carKey);

    if (!carNumber || !normalizedCarKey) {
      console.error('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Dynamically import Google APIs to avoid auth issues on module load
    const { google } = await import('googleapis');

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

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set');
    }

    // Submissions go to separate submissions spreadsheet
    const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
    if (!submissionsSpreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID environment variable not set');
    }

    const entriesSheetName = await resolveRaceEntriesSheetName(sheets, submissionsSpreadsheetId);
    const existingEntry = await findExistingEntry(sheets, submissionsSpreadsheetId, entriesSheetName, season, race, carNumber);
    if (!existingEntry) {
      await appendToSheet(sheets, submissionsSpreadsheetId, `${entriesSheetName}!A:D`, [
        season,
        race,
        carNumber,
        'entered'
      ]);
    }

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: `Submission failed: ${err.message}` });
  }
}

async function appendToSheet(sheets, spreadsheetId, range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: {
      values: [values]
    }
  });
}

function normalizeCarKey(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}

async function findExistingEntry(sheets, spreadsheetId, sheetName, season, race, carNumber) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:D`
  });

  const rows = response.data.values || [];
  const seasonStr = String(season);
  const raceStr = String(race);
  const carStr = String(carNumber);

  return rows.slice(1).some(row =>
    String(row[0]) === seasonStr
    && String(row[1]) === raceStr
    && String(row[2]) === carStr
  );
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
