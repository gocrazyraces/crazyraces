/**
 * Shared race-related utilities
 */

// Simple in-memory cache (for serverless environments, consider Redis/external cache)
const cache = new Map();

function getCachedData(key) {
  const item = cache.get(key);
  if (item && Date.now() < item.expires) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key, data, ttlMs) {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs
  });
}

// Parse dates - handle both ISO format and DD/MM/YYYY format
export function parseDate(dateStr) {
  // Try ISO format first (2026-06-26T20:00:00Z)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  // Try DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    date = new Date(`${year}-${month}-${day}T20:00:00Z`); // Default to 8 PM UTC
    if (!isNaN(date.getTime())) return date;
  }

  console.log('Invalid date format:', dateStr);
  return new Date('invalid');
}

export async function getRaceInfo() {
  // Check cache first (cache for 1 hour)
  const cacheKey = 'raceInfo';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const { createGoogleServices } = await import('../lib/google-auth.js');
    const { sheets } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    // Read race configuration from Sheet1 (race info is in the main sheet)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Sheet1!A:G', // Race info columns: season, racenumber, racename, racedeadline, racedescription, raceimage, racestatus
    });

    const rows = response.data.values || [];
    console.log('Spreadsheet rows:', rows); // Debug log

    const races = rows.slice(1).map(row => ({
      season: row[0],
      racenumber: row[1],
      racename: row[2],
      racedeadline: row[3],
      racedescription: row[4],
      raceimage: row[5],
      racestatus: row[6]
    }));

    console.log('Parsed races:', races); // Debug log

    // Find next active race
    const now = new Date();
    const nextRace = races
      .filter(race => {
        const isActive = race.racestatus === 'active';
        const raceDate = parseDate(race.racedeadline);
        const isFuture = raceDate > now;
        console.log(`Race "${race.racename}": active=${isActive}, date=${raceDate}, future=${isFuture}`);
        return isActive && isFuture;
      })
      .sort((a, b) => parseDate(a.racedeadline) - parseDate(b.racedeadline))[0];

    // Convert the deadline to ISO format for frontend
    if (nextRace) {
      nextRace.racedeadline = parseDate(nextRace.racedeadline).toISOString();
    }

    console.log('Next race found:', nextRace); // Debug log
    const result = nextRace || null;

    // Cache for 1 hour
    setCachedData(cacheKey, result, 60 * 60 * 1000);
    return result;

  } catch (error) {
    console.error('Error fetching race info:', error);
    return null;
  }
}

export async function validateActiveRace(season, racenumber) {
  const raceInfo = await getRaceInfo();

  if (!raceInfo) {
    return { valid: false, message: 'No active races available for entry' };
  }

  if (raceInfo.season !== season || raceInfo.racenumber !== racenumber) {
    return {
      valid: false,
      message: `Entry not allowed: Only accepting entries for active race (Season ${raceInfo.season}, Race ${raceInfo.racenumber})`
    };
  }

  return { valid: true };
}
