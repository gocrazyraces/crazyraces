import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    if (!req.body || !req.body.carData) {
      console.error('Request body missing carData:', req.body);
      return res.status(400).json({ message: 'Missing carData' });
    }

    const {
      carName,
      teamName,
      email,
      acceleration,
      topSpeed,
      wheelPositions,
      bodyImageData,
      wheelImageData
    } = req.body.carData;

    if (!email || !bodyImageData || !wheelImageData) {
      console.error('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // Hardcoded for now - can be made configurable
    const season = 'season1';
    const race = 'race1';

    // Find or create assets folder
    let assetsFolderId = await findOrCreateFolder(drive, 'assets', 'root');

    // Find or create season folder
    let seasonFolderId = await findOrCreateFolder(drive, season, assetsFolderId);

    // Find or create race folder
    let raceFolderId = await findOrCreateFolder(drive, race, seasonFolderId);

    // Create email-specific folder
    let emailFolderId = await findOrCreateFolder(drive, email, raceFolderId);

    // Upload files
    const jsonData = JSON.stringify({
      carName,
      teamName,
      email,
      acceleration,
      topSpeed,
      wheelPositions
    }, null, 2);

    const jsonFile = await uploadFile(drive, 'car.json', jsonData, 'application/json', emailFolderId);
    const bodyPngFile = await uploadFile(drive, 'body.png', Buffer.from(bodyImageData.split('base64,')[1], 'base64'), 'image/png', emailFolderId);
    const wheelPngFile = await uploadFile(drive, 'wheel.png', Buffer.from(wheelImageData.split('base64,')[1], 'base64'), 'image/png', emailFolderId);

    // Update spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    await appendToSheet(sheets, spreadsheetId, [
      season,
      race,
      email,
      teamName,
      carName,
      `https://drive.google.com/file/d/${bodyPngFile.data.id}/view`,
      `https://drive.google.com/file/d/${wheelPngFile.data.id}/view`,
      `https://drive.google.com/file/d/${jsonFile.data.id}/view`
    ]);

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: `Submission failed: ${err.message}` });
  }
}

async function findOrCreateFolder(drive, name, parentId) {
  // Search for existing folder
  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)'
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Create new folder
  const folderMetadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };

  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: 'id'
  });

  return folder.data.id;
}

async function uploadFile(drive, name, content, mimeType, parentId) {
  const fileMetadata = {
    name: name,
    parents: [parentId]
  };

  const media = {
    mimeType: mimeType,
    body: typeof content === 'string' ? Buffer.from(content) : content
  };

  return await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
}

async function appendToSheet(sheets, spreadsheetId, values) {
  const range = 'Sheet1!A:H'; // Assuming columns A to H

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: {
      values: [values]
    }
  });
}
