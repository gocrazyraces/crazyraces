// API endpoint to list active races for the entry dropdown
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { getAllRaces } = await import('../lib/race-utils.js');
    const races = await getAllRaces();

    const activeRaces = races
      .filter((race) => race.racestatus === 'active')
      .sort((a, b) => new Date(b.racedeadline) - new Date(a.racedeadline));

    return res.status(200).json({ races: activeRaces });
  } catch (error) {
    console.error('Error fetching active races:', error);
    return res.status(500).json({ message: `Failed to fetch races: ${error.message}` });
  }
};