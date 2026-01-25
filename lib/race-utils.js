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
  // Check cache first (cache for 5 minutes in development)
  const cacheKey = 'raceInfo';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const { createGoogleServices } = await import('../lib/google-auth.js');
    const { sheets } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const raceSheetName = await resolveRaceSheetName(sheets, spreadsheetId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${raceSheetName}!A:H`,
    });

    const races = parseRaceRows(response.data.values || []);

    // Find next active race
    const now = new Date();
    const nextRace = findNextActiveRace(races, now);

    console.log('Next race found:', nextRace); // Debug log
    const result = nextRace || null;

    // Cache for 5 minutes (development)
    setCachedData(cacheKey, result, 5 * 60 * 1000);
    return result;

  } catch (error) {
    console.error('Error fetching race info:', error);
    return null;
  }
}

export async function getAllRaces() {
  const cacheKey = 'raceInfoAll';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const { createGoogleServices } = await import('../lib/google-auth.js');
    const { sheets } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const raceSheetName = await resolveRaceSheetName(sheets, spreadsheetId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${raceSheetName}!A:H`,
    });

    const races = parseRaceRows(response.data.values || []);
    setCachedData(cacheKey, races, 5 * 60 * 1000);
    return races;
  } catch (error) {
    console.error('Error fetching race info:', error);
    return [];
  }
}

function parseRaceRows(rows) {
  console.log('Spreadsheet rows:', rows); // Debug log

  const races = rows.slice(1).map(row => ({
    season: row[0],
    racenumber: row[1],
    racename: row[2],
    racedeadline: row[3],
    racestart: row[4],
    racedescription: row[5],
    raceimage: row[6],
    racestatus: row[7]
  }));

  console.log('Parsed races:', races); // Debug log
  return races.map((race) => {
    const parsedDate = parseDate(race.racedeadline);
    const parsedStart = parseDate(race.racestart);
    return {
      ...race,
      racedeadline: isNaN(parsedDate.getTime()) ? race.racedeadline : parsedDate.toISOString()
      ,
      racestart: isNaN(parsedStart.getTime()) ? race.racestart : parsedStart.toISOString()
    };
  });
}

function findNextActiveRace(races, now = new Date()) {
  return races
    .filter(race => {
      const status = String(race.racestatus || '').toLowerCase();
      const isActive = status === 'active' || status === 'approved';
      const raceDate = parseDate(race.racedeadline);
      const isFuture = raceDate > now;
      console.log(`Race "${race.racename}": active=${isActive}, date=${raceDate}, future=${isFuture}`);
      return isActive && isFuture;
    })
    .sort((a, b) => parseDate(a.racedeadline) - parseDate(b.racedeadline))[0];
}

async function resolveRaceSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-race-info', 'Sheet1', 'Races', 'races', 'RaceInfo'];
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

  throw new Error('Unable to locate race info sheet (tried rapidracers-race-info, Sheet1, Races, races, RaceInfo)');
}

export async function validateActiveRace(season, racenumber) {
  const races = await getAllRaces();

  if (!races.length) {
    return { valid: false, message: 'No active races available for entry' };
  }

  const activeRace = races.find((race) =>
    race.racestatus === 'active'
    && String(race.season) === String(season)
    && String(race.racenumber) === String(racenumber)
  );

  if (!activeRace) {
    return {
      valid: false,
      message: 'Entry not allowed: Only accepting entries for active races.'
    };
  }

  return { valid: true };
}
