// API endpoint to get race results for a specific season and race
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;

  if (!season) {
    return res.status(400).json({ message: 'Missing season parameter' });
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
    const spreadsheetId = process.env.GOOGLE_SHEETS_RESULTS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_RESULTS_SPREADSHEET_ID not set');
    }

    // Read race results from Sheet1
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Sheet1!A:H', // season, racenumber, position, time, status, carnumber, carname, notes
    });

    const rows = response.data.values || [];
    console.log(`Race results for season ${season}${racenumber ? `, race ${racenumber}` : ''}:`, rows.length - 1, 'results found');

    // Parse results and filter by season (and racenumber if provided)
    const results = rows.slice(1)
      .filter(row => {
        const rowSeason = String(row[0]);
        const matches = rowSeason === String(season);
        if (racenumber) {
          const rowRace = String(row[1]);
          return matches && rowRace === String(racenumber);
        }
        return matches;
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
        // Sort by racenumber, then by position
        const raceCompare = parseInt(a.racenumber) - parseInt(b.racenumber);
        if (raceCompare !== 0) return raceCompare;
        return parseInt(a.position) - parseInt(b.position);
      });

    console.log(`Filtered results: ${results.length} entries`);

    return res.status(200).json({
      season,
      racenumber: racenumber || null,
      results,
      resultCount: results.length
    });

  } catch (error) {
    console.error('Error fetching race results:', error);
    return res.status(500).json({ message: 'Failed to fetch race results' });
  }
}
