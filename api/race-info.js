// API endpoint to get race information from Google Sheets
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { getRaceInfo } = await import('../lib/race-utils.js');
    const raceInfo = await getRaceInfo();
    return res.status(200).json({ raceInfo });

  } catch (error) {
    console.error('Error fetching race info:', error);
    return res.status(500).json({ message: `Failed to fetch race information: ${error.message}` });
  }
}
