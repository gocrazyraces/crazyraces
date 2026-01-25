import { requireAdminAuth } from '../lib/admin-auth.js';

export default async function handler(req, res) {
  if (!requireAdminAuth(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { rowIndex, status } = req.body || {};
  if (!rowIndex || !status) {
    return res.status(400).json({ message: 'Missing rowIndex or status' });
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
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!F${rowIndex}:F${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[String(status)]]
      }
    });

    return res.status(200).json({ message: 'Status updated' });
  } catch (error) {
    console.error('Error updating car status:', error);
    return res.status(500).json({ message: `Failed to update status: ${error.message}` });
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