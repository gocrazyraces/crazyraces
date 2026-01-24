// API endpoint to get car name list from Google Sheets
export default async function handler(req, res) {
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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Sheet1!B:B',
    });

    const rows = response.data.values || [];
    const names = rows.slice(1)
      .map(row => (row[0] || '').trim())
      .filter(Boolean);

    return res.status(200).json({
      names,
      nameCount: names.length
    });
  } catch (error) {
    console.error('Error fetching car names:', error);
    return res.status(500).json({ message: `Failed to fetch car names: ${error.message}` });
  }
}