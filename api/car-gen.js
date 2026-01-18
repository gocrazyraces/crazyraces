// API endpoint to generate simple car body and wheel images
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { type } = req.query; // 'body' or 'wheel'

  if (!type || !['body', 'wheel'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type parameter. Must be "body" or "wheel"' });
  }

  try {
    const sharp = (await import('sharp')).default;
    const { BODY_W, BODY_H, WHEEL_W, WHEEL_H } = await import('../lib/constants.js');

    let imageBuffer;

    if (type === 'body') {
      // Generate a simple car body image (1024x512)
      const svgBody = `
        <svg width="${BODY_W}" height="${BODY_H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#4ECDC4;stop-opacity:1" />
            </linearGradient>
          </defs>

          <!-- Car body -->
          <ellipse cx="${BODY_W/2}" cy="${BODY_H * 0.6}" rx="${BODY_W * 0.35}" ry="${BODY_H * 0.2}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>

          <!-- Car top -->
          <rect x="${BODY_W * 0.25}" y="${BODY_H * 0.4}" width="${BODY_W * 0.5}" height="${BODY_H * 0.25}" rx="${BODY_W * 0.05}" fill="#FF8E53" stroke="#333" stroke-width="2"/>

          <!-- Windows -->
          <rect x="${BODY_W * 0.3}" y="${BODY_H * 0.45}" width="${BODY_W * 0.15}" height="${BODY_H * 0.15}" rx="${BODY_W * 0.02}" fill="#87CEEB" opacity="0.7"/>
          <rect x="${BODY_W * 0.55}" y="${BODY_H * 0.45}" width="${BODY_W * 0.15}" height="${BODY_H * 0.15}" rx="${BODY_W * 0.02}" fill="#87CEEB" opacity="0.7"/>

          <!-- Headlights -->
          <circle cx="${BODY_W * 0.15}" cy="${BODY_H * 0.65}" r="${BODY_W * 0.02}" fill="#FFFF00"/>
          <circle cx="${BODY_W * 0.85}" cy="${BODY_H * 0.65}" r="${BODY_W * 0.02}" fill="#FFFF00"/>
        </svg>
      `;

      imageBuffer = await sharp(Buffer.from(svgBody)).png().toBuffer();

    } else if (type === 'wheel') {
      // Generate a simple wheel image (256x256)
      const svgWheel = `
        <svg width="${WHEEL_W}" height="${WHEEL_H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="wheelGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#333;stop-opacity:1" />
              <stop offset="70%" style="stop-color:#666;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#000;stop-opacity:1" />
            </radialGradient>
          </defs>

          <!-- Outer tire -->
          <circle cx="${WHEEL_W/2}" cy="${WHEEL_H/2}" r="${WHEEL_W * 0.45}" fill="url(#wheelGradient)" stroke="#222" stroke-width="2"/>

          <!-- Inner rim -->
          <circle cx="${WHEEL_W/2}" cy="${WHEEL_H/2}" r="${WHEEL_W * 0.25}" fill="#C0C0C0" stroke="#888" stroke-width="1"/>

          <!-- Spokes -->
          <line x1="${WHEEL_W/2}" y1="${WHEEL_H * 0.2}" x2="${WHEEL_W/2}" y2="${WHEEL_H * 0.8}" stroke="#888" stroke-width="3"/>
          <line x1="${WHEEL_W * 0.2}" y1="${WHEEL_H/2}" x2="${WHEEL_W * 0.8}" y2="${WHEEL_H/2}" stroke="#888" stroke-width="3"/>
          <line x1="${WHEEL_W * 0.3}" y1="${WHEEL_H * 0.3}" x2="${WHEEL_W * 0.7}" y2="${WHEEL_H * 0.7}" stroke="#888" stroke-width="2"/>
          <line x1="${WHEEL_W * 0.7}" y1="${WHEEL_H * 0.3}" x2="${WHEEL_W * 0.3}" y2="${WHEEL_H * 0.7}" stroke="#888" stroke-width="2"/>
        </svg>
      `;

      imageBuffer = await sharp(Buffer.from(svgWheel)).png().toBuffer();
    }

    // Return the generated image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(imageBuffer);

  } catch (error) {
    console.error('Error generating car image:', error);
    return res.status(500).json({ message: 'Failed to generate image' });
  }
}
