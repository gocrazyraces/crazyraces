// API endpoint to store a car in the garage (cars sheet + assets)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { carData } = req.body;
    if (!carData || !carData.season) {
      return res.status(400).json({ message: 'Missing carData or season' });
    }

    const {
      season,
      carName,
      carKey: existingCarKey,
      carNumber: existingCarNumber,
      acceleration,
      topSpeed,
      wheelPositions,
      bodyImageData,
      wheelImageData,
      bodyOffsetX,
      bodyOffsetY
    } = carData;

    if (!carName || !bodyImageData || !wheelImageData) {
      return res.status(400).json({ message: 'Missing required car fields' });
    }

    const { google } = await import('googleapis');
    const { Storage } = await import('@google-cloud/storage');
    const { JWT } = await import('google-auth-library');

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (parseError) {
      try {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
      } catch (base64Error) {
        throw new Error(`Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: ${parseError.message}. Also tried base64 decoding: ${base64Error.message}`);
      }
    }

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/devstorage.full_control']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const storage = google.storage({ version: 'v1', auth });

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set');
    }

    const carsSpreadsheetId = process.env.GOOGLE_SHEETS_CARS_SPREADSHEET_ID;
    if (!carsSpreadsheetId) {
      throw new Error('GOOGLE_SHEETS_CARS_SPREADSHEET_ID not set');
    }

    const existingCar = await findExistingCar(sheets, carsSpreadsheetId, carName, existingCarKey, existingCarNumber);
    const carKey = existingCar?.carkey || generateCarKey();
    const carNumber = existingCar?.carnumber || await getNextCarNumber(sheets, carsSpreadsheetId);
    const carVersion = existingCar ? String(Number(existingCar.carversion || 0) + 1) : '1';
    const basePath = `${season}/${carNumber}/`;

    const jsonFileName = `${basePath}car.json`;
    const bodyFileName = `${basePath}body.png`;
    const wheelFileName = `${basePath}wheel.png`;
    const previewFileName = `${basePath}preview.png`;

    const previewBuffer = await generateCompositePreview(bodyImageData, wheelImageData, wheelPositions);

    const jsonData = JSON.stringify({
      season,
      carName,
      carNumber,
      carKey,
      props: {
        acceleration,
        topSpeed
      },
      bodyOffsetX: bodyOffsetX ?? 0,
      bodyOffsetY: bodyOffsetY ?? 0,
      wheels: wheelPositions.map(wheel => ({
        ...wheel,
        imagePath: `https://storage.googleapis.com/${bucketName}/${wheelFileName}`
      })),
      widgets: [],
      imagePaths: {
        body: `https://storage.googleapis.com/${bucketName}/${bodyFileName}`,
        wheel: `https://storage.googleapis.com/${bucketName}/${wheelFileName}`,
        preview: `https://storage.googleapis.com/${bucketName}/${previewFileName}`
      }
    }, null, 2);

    await uploadToGCS(storage, bucketName, jsonFileName, Buffer.from(jsonData), 'application/json');
    await uploadToGCS(storage, bucketName, bodyFileName, Buffer.from(bodyImageData.split('base64,')[1], 'base64'), 'image/png');
    await uploadToGCS(storage, bucketName, wheelFileName, Buffer.from(wheelImageData.split('base64,')[1], 'base64'), 'image/png');
    await uploadToGCS(storage, bucketName, previewFileName, previewBuffer, 'image/png');

    if (existingCar) {
      await updateCarRow(sheets, carsSpreadsheetId, existingCar.rowIndex, [
        season,
        carNumber,
        carKey,
        carName,
        carVersion,
        existingCar.carstatus || 'submitted',
        `https://storage.googleapis.com/${bucketName}/${previewFileName}`,
        `https://storage.googleapis.com/${bucketName}/${jsonFileName}`
      ]);
    } else {
      await appendToSheet(sheets, carsSpreadsheetId, 'rapidracers-cars!A:H', [
        season,
        carNumber,
        carKey,
        carName,
        carVersion,
        'submitted',
        `https://storage.googleapis.com/${bucketName}/${previewFileName}`,
        `https://storage.googleapis.com/${bucketName}/${jsonFileName}`
      ]);
    }

    return res.status(200).json({
      message: 'Garage submission successful',
      carKey,
      carNumber,
      carJsonPath: `https://storage.googleapis.com/${bucketName}/${jsonFileName}`,
      carImagePath: `https://storage.googleapis.com/${bucketName}/${previewFileName}`
    });
  } catch (err) {
    console.error('Garage submission error:', err);
    return res.status(500).json({ message: `Garage submission failed: ${err.message}` });
  }
};

function generateCarKey() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
}

async function getNextCarNumber(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'rapidracers-cars!B:B'
  });

  const rows = response.data.values || [];
  const numbers = rows.slice(1)
    .map(row => parseInt(row[0], 10))
    .filter(Number.isFinite);

  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return String(nextNumber);
}

async function uploadToGCS(storage, bucketName, fileName, buffer, contentType) {
  const request = {
    bucket: bucketName,
    name: fileName,
    media: {
      mimeType: contentType,
      body: buffer
    }
  };

  await storage.objects.insert(request);
}

async function appendToSheet(sheets, spreadsheetId, range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: {
      values: [values]
    }
  });
}

async function findExistingCar(sheets, spreadsheetId, carName, carKey, carNumber) {
  if (!carName && !carKey && !carNumber) return null;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'rapidracers-cars!A:H'
  });

  const rows = response.data.values || [];
  const normalizedKey = normalizeCarKey(carKey);
  const normalizedName = String(carName || '').trim().toLowerCase();
  const normalizedNumber = carNumber ? String(carNumber) : null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowName = String(row[3] || '').trim().toLowerCase();
    const rowKey = normalizeCarKey(row[2]);
    const rowNumber = String(row[1] || '');

    const nameMatches = normalizedName && rowName === normalizedName;
    const keyMatches = normalizedKey && rowKey === normalizedKey;
    const numberMatches = normalizedNumber && rowNumber === normalizedNumber;

    if (nameMatches && (keyMatches || numberMatches)) {
      return {
        rowIndex: i + 1,
        season: row[0],
        carnumber: row[1],
        carkey: row[2],
        carname: row[3],
        carversion: row[4],
        carstatus: row[5]
      };
    }
  }

  return null;
}

async function updateCarRow(sheets, spreadsheetId, rowIndex, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `rapidracers-cars!A${rowIndex}:H${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [values]
    }
  });
}

function normalizeCarKey(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}

// Generate composite preview image server-side using Sharp
async function generateCompositePreview(bodyImageData, wheelImageData, wheelPositions) {
  const sharp = (await import('sharp')).default;

  const bodyBuffer = Buffer.from(bodyImageData.split('base64,')[1], 'base64');
  const wheelBuffer = Buffer.from(wheelImageData.split('base64,')[1], 'base64');

  let composite = sharp(bodyBuffer).png();
  const overlays = [];

  for (const wheel of wheelPositions || []) {
    const scale = wheel.scale || 1;
    const rotation = wheel.rotationDegrees || 0;

    const resizedWheel = await sharp(wheelBuffer)
      .png()
      .resize({
        width: Math.round(256 * scale),
        height: Math.round(256 * scale),
        withoutEnlargement: false
      });

    let transformedWheel;
    if (rotation !== 0) {
      transformedWheel = await resizedWheel
        .rotate(rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          withoutEnlargement: true
        })
        .png()
        .toBuffer();
    } else {
      transformedWheel = await resizedWheel.png().toBuffer();
    }

    const halfWidth = Math.round(128 * scale);
    const halfHeight = Math.round(128 * scale);

    overlays.push({
      input: transformedWheel,
      top: Math.round(wheel.y - halfHeight),
      left: Math.round(wheel.x - halfWidth)
    });
  }

  if (overlays.length > 0) {
    composite = composite.composite(overlays);
  }

  return await composite.toBuffer();
}