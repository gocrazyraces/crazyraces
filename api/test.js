// Simple test API to check if Vercel routes are working
module.exports = async function handler(req, res) {
  const { type } = req.query;

  if (type === 'spreadsheet') {
    // Test spreadsheet connection
    try {
      const { createGoogleServices } = await import('../lib/google-auth.js');
      const { sheets } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets']);
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A:G',
      });

      const rows = response.data.values || [];
      return res.status(200).json({
        message: 'Spreadsheet connection working!',
        spreadsheetId: spreadsheetId,
        rowCount: rows.length,
        firstFewRows: rows.slice(0, 5),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Spreadsheet connection failed!',
        error: error.message,
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        hasCredentials: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      });
    }
  }

  return res.status(200).json({
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}
