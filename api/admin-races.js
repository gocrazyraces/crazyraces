import { requireAdminAuth } from '../lib/admin-auth.js';

export default async function handler(req, res) {
  if (!requireAdminAuth(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    }

    const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));
    const { JWT } = await import('google-auth-library');
    const { google } = await import('googleapis');

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
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
  } catch (error) {
    console.error('Error fetching admin races:', error);
    return res.status(500).json({ message: `Failed to fetch races: ${error.message}` });
  }
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