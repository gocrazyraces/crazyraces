/**
 * Shared Google authentication utilities
 */

export async function createGoogleAuth(scopes = []) {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  }

  const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));

  const { JWT } = await import('google-auth-library');
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: scopes
  });
}

export async function createGoogleServices(scopes = []) {
  const auth = await createGoogleAuth(scopes);

  const { google } = await import('googleapis');
  const { Storage } = await import('@google-cloud/storage');

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));

  return {
    auth,
    sheets: google.sheets({ version: 'v4', auth }),
    storage: google.storage({ version: 'v1', auth }),
    storageClient: new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    })
  };
}
