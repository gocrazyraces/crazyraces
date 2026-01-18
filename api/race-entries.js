// API endpoint to get approved race entries for a specific race
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;

  if (!season || !racenumber) {
    return res.status(400).json({ message: 'Missing season or racenumber parameters' });
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
    const spreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID not set');
    }

    // Read submissions from Sheet2
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Sheet2!A:J', // All columns: season to racerwheelimagepath
    });

    const rows = response.data.values || [];
    console.log(`Race entries for season ${season}, race ${racenumber}:`, rows.length - 1, 'entries found');

    // Parse entries and filter for approved ones in this race
    const entries = rows.slice(1)
      .filter(row => row[0] === season && row[1] === racenumber && row[5] === 'approved')
      .map(row => ({
        teamName: row[3],  // racerteamname
        carName: row[4]    // racercarname
      }));

    const entryCount = entries.length;

    console.log(`Approved entries: ${entryCount}`);

    return res.status(200).json({
      season,
      racenumber,
      entries,
      entryCount
    });

  } catch (error) {
    console.error('Error fetching race entries:', error);
    return res.status(500).json({ message: 'Failed to fetch race entries' });
  }
}
