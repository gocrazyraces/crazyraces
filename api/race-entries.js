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

    const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
    if (!submissionsSpreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID not set');
    }

    const entriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: submissionsSpreadsheetId,
      range: 'rapidracers-race-entries!A:D',
    });

    const carsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID,
      range: 'rapidracers-cars!A:H',
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
        carjsonpath: row[7]
      }])
    );

    console.log(`Race entries for season ${season}, race ${racenumber}:`, entryRows.length - 1, 'total entries found');

    const entries = entryRows.slice(1)
      .filter(row => {
        const rowSeason = String(row[0]);
        const rowRace = String(row[1]);
        const rowStatus = String(row[3]).toLowerCase();
        const matches = rowSeason === seasonStr && rowRace === racenumberStr && rowStatus === 'approved';
        console.log(`Entry check: season=${rowSeason}(${rowSeason === seasonStr}), race=${rowRace}(${rowRace === racenumberStr}), status=${rowStatus}(${rowStatus === 'approved'}) → ${matches}`);
        return matches;
      })
      .map(row => {
        const carNumber = String(row[2]);
        const car = carsByNumber.get(carNumber);
        return {
          carNumber,
          carName: car?.carname || 'Unknown Car',
          carImagePath: car?.carimagepath || '',
        };
      });

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
