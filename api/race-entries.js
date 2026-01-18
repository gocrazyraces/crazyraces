// API endpoint to get approved race entries for a specific race
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;

  if (!season || !racenumber) {
    return res.status(400).json({ message: 'Missing season or racenumber parameters' });
  }

  // Convert to strings for consistent comparison
  const seasonStr = String(season);
  const racenumberStr = String(racenumber);

  try {
    console.log('Starting race-entries API call with params:', { season, racenumber });

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    }

    console.log('Parsing service account credentials...');
    const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));
    console.log('Service account email:', credentials.client_email);

    const { JWT } = await import('google-auth-library');
    const { google } = await import('googleapis');

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    console.log('Target spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      console.error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable not set');
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
    }

    // Read submissions from separate submissions spreadsheet
    const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
    if (!submissionsSpreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID not set');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: submissionsSpreadsheetId,
      range: 'Sheet1!A:H', // All submissions in Sheet1 (8 columns)
    });

    const rows = response.data.values || [];
    console.log(`Race entries for season ${season}, race ${racenumber}:`, rows.length - 1, 'total entries found');
    console.log('All entries:', rows.slice(1).map(row => ({
      season: row[0],
      racenumber: row[1],
      email: row[2],
      teamName: row[3],
      carName: row[4],
      status: row[5]
    })));

    // Parse entries and filter for approved ones in this race
    const entries = rows.slice(1)
      .filter(row => {
        const rowSeason = String(row[0]); // Convert to string for comparison
        const rowRace = String(row[1]);   // Convert to string for comparison
        const rowStatus = String(row[5]).toLowerCase(); // Case insensitive status
        const matches = rowSeason === seasonStr && rowRace === racenumberStr && rowStatus === 'approved';
        console.log(`Entry check: season=${rowSeason}(${rowSeason === seasonStr}), race=${rowRace}(${rowRace === racenumberStr}), status=${rowStatus}(${rowStatus === 'approved'}) → ${matches}`);
        return matches;
      })
      .map(row => ({
        teamName: row[3],  // racerteamname
        carName: row[4]    // racercarname
      }));

    const entryCount = entries.length;
    console.log(`Final approved entries: ${entryCount}`, entries);

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
