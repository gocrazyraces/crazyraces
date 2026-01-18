// Simple test API to check if Vercel routes are working
module.exports = async function handler(req, res) {
  const { type } = req.query;

  if (type === 'spreadsheet') {
    // Test spreadsheet connection
    try {
      const { createGoogleServices } = await import('../lib/google-auth.js');
      const { sheets } = await createGoogleServices(['https://www.googleapis.com/auth/spreadsheets']);
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

      // Get spreadsheet metadata to see available sheets
      const spreadsheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });

      const sheetNames = spreadsheetResponse.data.sheets.map(sheet => sheet.properties.title);

      // Test multiple ranges to find where data is
      const ranges = ['Sheet1!A:G', 'Sheet2!A:G', 'Sheet1!A:Z', 'Sheet2!A:Z'];
      const rangeResults = {};

      for (const range of ranges) {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
          });
          const rows = response.data.values || [];
          rangeResults[range] = {
            rowCount: rows.length,
            firstFewRows: rows.slice(0, 3)
          };
        } catch (rangeError) {
          rangeResults[range] = { error: rangeError.message };
        }
      }

      return res.status(200).json({
        message: 'Spreadsheet connection working!',
        spreadsheetId: spreadsheetId,
        availableSheets: sheetNames,
        rangeResults: rangeResults,
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
