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
    const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
    }

    const sheetName = await resolveCarsSheetName(sheets, spreadsheetId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:H`,
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
      carjsonpath: row[7]
    }));

    return res.status(200).json({ cars });
  } catch (error) {
    console.error('Error fetching admin cars:', error);
    return res.status(500).json({ message: `Failed to fetch cars: ${error.message}` });
  }
}

async function resolveCarsSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-cars', 'Sheet1', 'Cars', 'cars'];
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

  throw new Error('Unable to locate cars sheet (tried rapidracers-cars, Sheet1, Cars, cars)');
}