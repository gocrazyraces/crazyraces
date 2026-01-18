// Simple test API to check if Vercel routes are working
export default async function handler(req, res) {
  return res.status(200).json({
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}
