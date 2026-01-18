// Use dynamic imports to avoid authentication issues on module load
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

// Canvas dimensions (matching client-side constants)
const BODY_W = 1024;
const BODY_H = 512;

// ============================
// RACE INFO API (shared)
// ============================
export { getRaceInfo, validateActiveRace } from '../lib/race-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Extract season and race from request body
  const { carData } = req.body;
  if (!carData || !carData.season || !carData.race) {
    return res.status(400).json({ message: 'Missing season or race in carData' });
  }

  const { season, race } = carData;

  try {
    // Validate that the season/race corresponds to an active race
    const { validateActiveRace } = await import('../lib/race-utils.js');
    const validation = await validateActiveRace(season, race);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    console.log(`Entry validation passed for Season ${season}, Race ${race}`);

    // Now proceed with the submission
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
    } = carData;

    if (!email || !bodyImageData || !wheelImageData) {
      console.error('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Dynamically import Google APIs to avoid auth issues on module load
    const { google } = await import('googleapis');
    const { Storage } = await import('@google-cloud/storage');

    // Authenticate with Google
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    let credentials;
    try {
      // Try parsing as plain JSON first
      credentials = JSON.parse(serviceAccountKey);
    } catch (parseError) {
      try {
        // If that fails, try decoding from base64
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
      } catch (base64Error) {
        throw new Error(`Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: ${parseError.message}. Also tried base64 decoding: ${base64Error.message}`);
      }
    }

    // Validate credentials object
    if (!credentials.type || credentials.type !== 'service_account') {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not a valid service account key (missing or wrong type)');
    }
    if (!credentials.project_id) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing project_id');
    }
    if (!credentials.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing private_key');
    }
    if (!credentials.client_email) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email');
    }

    // Use JWT auth directly to avoid ADC issues
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/devstorage.full_control']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const storage = google.storage({ version: 'v1', auth });

    // Create separate auth for @google-cloud/storage signed URLs
    const storageAuth = new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    });

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set');
    }

    // Create folder-like structure in GCS (using prefixes)
    const basePath = `${season}/${race}/${email}/`;

    // Define file names first
    const jsonFileName = `${basePath}car.json`;
    const bodyFileName = `${basePath}body.png`;
    const wheelFileName = `${basePath}wheel.png`;
    const previewFileName = `${basePath}preview.png`;

    // Generate composite preview image
    const previewBuffer = await generateCompositePreview(bodyImageData, wheelImageData, wheelPositions);

    // Create new car.json structure
    const jsonData = JSON.stringify({
      season,
      race,
      carName,
      teamName,
      email,
      props: {
        acceleration,
        topSpeed
      },
      wheels: wheelPositions.map(wheel => ({
        ...wheel,
        imagePath: `https://storage.googleapis.com/${bucketName}/${wheelFileName}` // Same path for all wheels for now
      })),
      widgets: [], // For future extensibility
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

    // Files remain private - access controlled by bucket IAM permissions
    // Only users granted Storage Object Viewer role can access them

    // Update spreadsheet with GCS URLs (accessible only to authorized users)
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable not set');
    }

    // Submissions go to separate submissions spreadsheet
    const submissionsSpreadsheetId = process.env.GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID;
    if (!submissionsSpreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SUBMISSIONS_SPREADSHEET_ID environment variable not set');
    }

    await appendToSheet(sheets, submissionsSpreadsheetId, 'Sheet1!A:H', [
      season,                                    // A: season
      race,                                      // B: racenumber
      email,                                     // C: raceremail
      teamName,                                  // D: racerteamname
      carName,                                   // E: racercarname
      'submitted',                               // F: racerstatus (default to submitted)
      `https://storage.googleapis.com/${bucketName}/${previewFileName}`, // G: racerimagepath (composite preview)
      `https://storage.googleapis.com/${bucketName}/${jsonFileName}`     // H: racerjsoncarpath (car.json)
    ]);

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: `Submission failed: ${err.message}` });
  }
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

async function generateSignedUrl(storageAuth, bucketName, fileName) {
  const bucket = storageAuth.bucket(bucketName);
  const file = bucket.file(fileName);

  // Generate signed URL valid for 1 year
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  });

  return url;
}

// Generate composite preview image server-side using Sharp
async function generateCompositePreview(bodyImageData, wheelImageData, wheelPositions) {
  const sharp = (await import('sharp')).default;

  // Decode base64 images
  const bodyBuffer = Buffer.from(bodyImageData.split('base64,')[1], 'base64');
  const wheelBuffer = Buffer.from(wheelImageData.split('base64,')[1], 'base64');

  // Start with body image
  let composite = sharp(bodyBuffer).png();

  // Add wheels as overlays
  const overlays = [];

  for (const wheel of wheelPositions || []) {
    const scale = wheel.scale || 1;
    const rotation = wheel.rotationDegrees || 0;

    // Create wheel overlay with transformations
    const resizedWheel = await sharp(wheelBuffer)
      .png()
      .resize({
        width: Math.round(256 * scale),
        height: Math.round(256 * scale),
        withoutEnlargement: false
      });

    let transformedWheel;
    if (rotation !== 0) {
      // Apply rotation with transparent background and no enlargement
      transformedWheel = await resizedWheel
        .rotate(rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
          withoutEnlargement: true // Prevent canvas expansion
        })
        .png()
        .toBuffer();
    } else {
      // No rotation needed
      transformedWheel = await resizedWheel.png().toBuffer();
    }

    // Calculate position - center the wheel on its target position
    const halfWidth = Math.round(128 * scale);
    const halfHeight = Math.round(128 * scale);

    overlays.push({
      input: transformedWheel,
      top: Math.round(wheel.y - halfHeight),
      left: Math.round(wheel.x - halfWidth)
    });
  }

  // Apply all overlays
  if (overlays.length > 0) {
    composite = composite.composite(overlays);
  }

  // Return buffer for upload
  return await composite.toBuffer();
}

async function makeFilePublic(storage, bucketName, fileName) {
  const request = {
    bucket: bucketName,
    object: fileName,
    resource: {
      entity: 'allUsers',
      role: 'READER'
    }
  };

  await storage.objectAccessControls.insert(request);
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
