// API endpoint to generate ZIP file with all race assets for approved entries
// This is for race admins only - should be protected/private
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { season, racenumber } = req.query;

  if (!season || !racenumber) {
    return res.status(400).json({ message: 'Missing season or racenumber parameters' });
  }

  try {
    const { createGoogleServices } = await import('../lib/google-auth.js');
    const { sheets, storageClient: storage } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/cloud-platform']);

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
    }

    // Get race information
    const raceInfoResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'Sheet1!A:G',
    });

    const raceRows = raceInfoResponse.data.values || [];
    const raceData = raceRows.slice(1).find(row => {
      const rowSeason = String(row[0]);
      const rowRace = String(row[1]);
      return rowSeason === String(season) && rowRace === String(racenumber);
    });

    if (!raceData) {
      return res.status(404).json({ message: 'Race not found' });
    }

    const raceInfo = {
      season: raceData[0],
      racenumber: raceData[1],
      racename: raceData[2],
      racedeadline: raceData[3],
      racedescription: raceData[4],
      raceimage: raceData[5],
      racestatus: raceData[6]
    };

    // Get approved entries
    const entriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID,
      range: 'Sheet1!A:J',
    });

    const entryRows = entriesResponse.data.values || [];
    const approvedEntries = entryRows.slice(1)
      .filter(row => {
        const rowSeason = String(row[0]);
        const rowRace = String(row[1]);
        const rowStatus = String(row[5]).toLowerCase();
        return rowSeason === String(season) && rowRace === String(racenumber) && rowStatus === 'approved';
      })
      .map(row => ({
        season: row[0],
        racenumber: row[1],
        raceremail: row[2], // Include email for folder naming
        racerteamname: row[3],
        racercarname: row[4],
        racerstatus: row[5],
        racerimagepath: row[6],
        racerjsonpath: row[7],
        racerbodyimagepath: row[8],
        racerwheelimagepath: row[9]
      }));

    if (approvedEntries.length === 0) {
      return res.status(404).json({ message: 'No approved entries found for this race' });
    }

    // Create ZIP file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const folderName = `race-assets-season-${season}-racenumber-${racenumber}`;

    // Add race info
    zip.file(`${folderName}/race-info.json`, JSON.stringify(raceInfo, null, 2));

    // Add each approved entry
    for (const entry of approvedEntries) {
      const emailFolder = `${folderName}/${entry.raceremail}`;

      // Create entry.json with race-entries data (excluding GCS URLs)
      const entryData = {
        season: entry.season,
        racenumber: entry.racenumber,
        racerteamname: entry.racerteamname,
        racercarname: entry.racercarname,
        racerstatus: entry.racerstatus
      };
      zip.file(`${emailFolder}/entry.json`, JSON.stringify(entryData, null, 2));

      // Download and add files from GCS
      const filesToDownload = [
        { gcsPath: entry.racerjsonpath, localName: 'car.json', isText: true },
        { gcsPath: entry.racerbodyimagepath, localName: 'body.png', isText: false },
        { gcsPath: entry.racerwheelimagepath, localName: 'wheel.png', isText: false }
      ];

      for (const file of filesToDownload) {
        try {
          // Use WHATWG URL API instead of url.parse()
          const url = new URL(file.gcsPath);
          let filePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

          // Remove bucket name from path if present (URLs already include bucket)
          if (filePath.startsWith(`${bucketName}/`)) {
            filePath = filePath.slice(bucketName.length + 1);
          }

          const bucket = storage.bucket(bucketName);
          const fileObj = bucket.file(filePath);

          if (file.isText) {
            // Download text files as UTF-8 strings
            const [contents] = await fileObj.download();
            const textContent = contents.toString('utf8');
            zip.file(`${emailFolder}/${file.localName}`, textContent);
          } else {
            // Download binary files as buffers
            const [buffer] = await fileObj.download();
            zip.file(`${emailFolder}/${file.localName}`, buffer);
          }
        } catch (error) {
          console.error(`Failed to download ${file.gcsPath}:`, error);
          // Continue with other files
        }
      }
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Return ZIP file
    const fileName = `race-assets-season-${season}-racenumber-${racenumber}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);

  } catch (error) {
    console.error('Error generating race assets ZIP:', error);
    return res.status(500).json({ message: 'Failed to generate race assets' });
  }
}
