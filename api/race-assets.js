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

    const entriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID,
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

    const approvedEntries = entryRows.slice(1)
      .filter(row => {
        const rowSeason = String(row[0]);
        const rowRace = String(row[1]);
        const rowStatus = String(row[3]).toLowerCase();
        return rowSeason === String(season) && rowRace === String(racenumber) && rowStatus === 'approved';
      })
      .map(row => {
        const carNumber = String(row[2]);
        const car = carsByNumber.get(carNumber);
        return {
          season: row[0],
          racenumber: row[1],
          carnumber: carNumber,
          racerstatus: row[3],
          carname: car?.carname || '',
          carimagepath: car?.carimagepath || '',
          carjsonpath: car?.carjsonpath || ''
        };
      });

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
      const carFolder = `${folderName}/car-${entry.carnumber}`;

      // Create entry.json with race-entries data (excluding GCS URLs)
      const entryData = {
        season: entry.season,
        racenumber: entry.racenumber,
        carnumber: entry.carnumber,
        carname: entry.carname,
        entrystatus: entry.racerstatus
      };
      zip.file(`${carFolder}/entry.json`, JSON.stringify(entryData, null, 2));

      // First download and parse the car.json to get image paths
      let carData = null;
      try {
        const jsonUrl = new URL(entry.carjsonpath);
        let jsonFilePath = jsonUrl.pathname.startsWith('/') ? jsonUrl.pathname.slice(1) : jsonUrl.pathname;
        if (jsonFilePath.startsWith(`${bucketName}/`)) {
          jsonFilePath = jsonFilePath.slice(bucketName.length + 1);
        }

        const bucket = storage.bucket(bucketName);
        const jsonFileObj = bucket.file(jsonFilePath);
        const [jsonContents] = await jsonFileObj.download();
        const jsonText = jsonContents.toString('utf8');
        carData = JSON.parse(jsonText);
        zip.file(`${carFolder}/car.json`, jsonText);
      } catch (error) {
        console.error(`Failed to download car.json for ${entry.carnumber}:`, error);
        continue; // Skip this entry if we can't get the JSON
      }

      // Now download the image files using paths from car.json
      const filesToDownload = [
        { gcsPath: entry.carimagepath, localName: 'preview.png', isText: false },
        { gcsPath: carData.imagePaths.body, localName: 'body.png', isText: false },
        { gcsPath: carData.imagePaths.wheel, localName: 'wheel.png', isText: false }
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

          // Download binary files as buffers (all images)
          const [buffer] = await fileObj.download();
          zip.file(`${carFolder}/${file.localName}`, buffer);
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
