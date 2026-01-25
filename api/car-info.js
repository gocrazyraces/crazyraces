// API endpoint to get car information from Google Sheets
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    }

    const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));
    const { JWT } = await import('google-auth-library');
    const { google } = await import('googleapis');
    const { Storage } = await import('@google-cloud/storage');

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const storageClient = new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    });
    const spreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
    }

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not set');
    }

    const carsSheetName = await resolveCarsSheetName(sheets, spreadsheetId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${carsSheetName}!A:H`,
    });

    const rows = response.data.values || [];
    const cars = rows.slice(1)
      .map(row => ({
        season: row[0],
        carnumber: row[1],
        carkey: row[2],
        carname: row[3],
        carversion: row[4],
        carstatus: row[5],
        carimagepath: row[6],
        carjsonpath: row[7]
      }))
      .filter(car => String(car.carstatus || '').toLowerCase() === 'approved');

    const bucket = storageClient.bucket(bucketName);
    const carsWithPreview = await Promise.all(
      cars.map(async (car) => {
        const previewImageData = await downloadImageAsDataUrl(bucket, bucketName, car.carimagepath);
        return {
          ...car,
          previewImageData
        };
      })
    );

    return res.status(200).json({
      cars: carsWithPreview,
      carCount: carsWithPreview.length
    });
  } catch (error) {
    console.error('Error fetching car info:', error);
    return res.status(500).json({ message: `Failed to fetch car info: ${error.message}` });
  }
}

async function resolveCarsSheetName(sheets, spreadsheetId) {
  const candidateNames = ['rapidracers-cars', 'Sheet1', 'Cars', 'cars'];
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

  throw new Error('Unable to locate cars sheet (tried rapidracers-cars, Sheet1, Cars, cars)');
}

async function downloadImageAsDataUrl(bucket, bucketName, url) {
  if (!url) return null;
  try {
    const filePath = parseBucketPath(bucketName, url);
    const [contents] = await bucket.file(filePath).download();
    const base64 = contents.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.warn('Failed to download preview image:', url, error.message);
    return null;
  }
}

function parseBucketPath(bucketName, url) {
  const parsed = new URL(url);
  let path = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  if (path.startsWith(`${bucketName}/`)) {
    path = path.slice(bucketName.length + 1);
  }
  return path;
}