// API endpoint to get race information from Google Sheets
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    console.log('Race-info API called');
    console.log('GOOGLE_SHEETS_SPREADSHEET_ID:', process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    console.log('GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const { getRaceInfo } = await import('../lib/race-utils.js');
    const raceInfo = await getRaceInfo();

    console.log('Race-info API result:', raceInfo);
    return res.status(200).json({ raceInfo });

  } catch (error) {
    console.error('Error fetching race info:', error);
    return res.status(500).json({ message: `Failed to fetch race information: ${error.message}` });
  }
}
