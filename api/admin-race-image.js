import { requireAdminAuth } from '../lib/admin-auth.js';
import { createGoogleServices } from '../lib/google-auth.js';

export default async function handler(req, res) {
  if (!requireAdminAuth(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber, imageData } = req.body || {};
  if (!season || !racenumber || !imageData) {
    return res.status(400).json({ message: 'Missing season, racenumber, or imageData' });
  }

  try {
    const { sheets, storageClient } = await createGoogleServices([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/devstorage.read_write'
    ]);

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
    }

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
    }

    const sheetName = await resolveRaceSheetName(sheets, spreadsheetId);
    const rowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:H`
    });

    const rows = rowsResponse.data.values || [];
    const rowIndex = rows.findIndex((row, idx) => idx > 0
      && String(row[0]) === String(season)
      && String(row[1]) === String(racenumber));

    if (rowIndex < 1) {
      return res.status(404).json({ message: 'Race not found' });
    }

    const filename = `race-${racenumber}-${Date.now()}.png`;
    const objectPath = `races/${season}/${racenumber}/${filename}`;
    const buffer = Buffer.from(imageData.split('base64,')[1], 'base64');

    const bucket = storageClient.bucket(bucketName);
    await bucket.file(objectPath).save(buffer, { contentType: 'image/png' });

    const imageUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!G${rowIndex + 1}:G${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[imageUrl]]
      }
    });

    return res.status(200).json({ message: 'Race image updated', imageUrl });
  } catch (error) {
    console.error('Error uploading race image:', error);
    return res.status(500).json({ message: `Failed to upload race image: ${error.message}` });
  }
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