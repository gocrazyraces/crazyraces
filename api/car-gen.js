// API endpoint to generate diverse car body and wheel images
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { type, seed } = req.query; // 'body' or 'wheel', optional seed for reproducibility

  if (!type || !['body', 'wheel'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type parameter. Must be "body" or "wheel"' });
  }

  try {
    const sharp = (await import('sharp')).default;
    const { BODY_W, BODY_H, WHEEL_W, WHEEL_H } = await import('../lib/constants.js');

    // Create seeded random number generator for reproducible results
    let seedValue = seed ? parseInt(seed, 10) : Date.now();
    const random = seedRandom(seedValue);

    let imageBuffer;

    if (type === 'body') {
      // Generate diverse car body designs
      imageBuffer = await generateCarBody(BODY_W, BODY_H, random);

    } else if (type === 'wheel') {
      // Generate diverse wheel designs
      imageBuffer = await generateWheel(WHEEL_W, WHEEL_H, random);
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

// Seeded random number generator for reproducible results
function seedRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return function() {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

// Generate diverse car body designs
async function generateCarBody(width, height, random) {
  const sharp = (await import('sharp')).default;

  // Randomize car design parameters
  const bodyStyle = Math.floor(random() * 6); // 0-5 different styles
  const colorScheme = Math.floor(random() * 10); // 0-9 color schemes
  const detailLevel = Math.floor(random() * 3); // 0-2 detail levels
  const pattern = Math.floor(random() * 4); // 0=none, 1=stripes, 2=flames, 3=checker
  const accessories = Math.floor(random() * 3); // 0=none, 1=spoiler, 2=exhaust

  // Color schemes
  const colorSchemes = [
    { primary: '#FF6B6B', secondary: '#4ECDC4', accent: '#45B7D1' }, // Red to teal
    { primary: '#A8E6CF', secondary: '#FFD3A5', accent: '#FFAAA5' }, // Pastel
    { primary: '#667EEA', secondary: '#764BA2', accent: '#F093FB' }, // Purple gradient
    { primary: '#F093FB', secondary: '#F5576C', accent: '#4ECDC4' }, // Pink to coral
    { primary: '#4ECDC4', secondary: '#44A08D', accent: '#096D57' }, // Green tones
    { primary: '#FF4500', secondary: '#FFD700', accent: '#000000' }, // Orange and gold
    { primary: '#00FF00', secondary: '#008000', accent: '#FFFF00' }, // Lime green
    { primary: '#FF1493', secondary: '#8A2BE2', accent: '#00FFFF' }, // Neon pink purple
    { primary: '#DC143C', secondary: '#B22222', accent: '#F0E68C' }, // Crimson
    { primary: '#20B2AA', secondary: '#5F9EA0', accent: '#F5DEB3' }  // Teal
  ];

  const colors = colorSchemes[colorScheme];

  let svgBody = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
      </linearGradient>
      <linearGradient id="roofGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors.accent};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
      </linearGradient>
    </defs>`;

  const centerX = width / 2;
  const bodyY = height * 0.6;

  if (bodyStyle === 0) {
    // Sports car style - low and wide
    svgBody += `
      <!-- Main body - sports car -->
      <ellipse cx="${centerX}" cy="${bodyY}" rx="${width * (0.4 + random() * 0.1)}" ry="${height * (0.15 + random() * 0.05)}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Hood scoop -->
      <ellipse cx="${centerX}" cy="${bodyY - height * 0.05}" rx="${width * 0.15}" ry="${height * 0.03}" fill="${colors.accent}" opacity="0.8"/>
      <!-- Roof - low profile -->
      <rect x="${centerX - width * 0.2}" y="${bodyY - height * 0.08}" width="${width * 0.4}" height="${height * 0.12}" rx="${width * 0.03}" fill="url(#roofGradient)" stroke="#333" stroke-width="2"/>`;

  } else if (bodyStyle === 1) {
    // SUV style - taller and boxier
    svgBody += `
      <!-- Main body - SUV -->
      <rect x="${centerX - width * 0.35}" y="${bodyY - height * 0.15}" width="${width * 0.7}" height="${height * 0.25}" rx="${width * 0.08}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Roof - higher -->
      <rect x="${centerX - width * 0.25}" y="${bodyY - height * 0.2}" width="${width * 0.5}" height="${height * 0.15}" rx="${width * 0.04}" fill="url(#roofGradient)" stroke="#333" stroke-width="2"/>
      <!-- Roof rack -->
      <rect x="${centerX - width * 0.15}" y="${bodyY - height * 0.22}" width="${width * 0.3}" height="${height * 0.02}" fill="#666" rx="${width * 0.01}"/>`;

  } else if (bodyStyle === 2) {
    // Coupe style - sleek and curved
    svgBody += `
      <!-- Main body - coupe -->
      <path d="M ${centerX - width * 0.4} ${bodyY} Q ${centerX - width * 0.2} ${bodyY - height * 0.1} ${centerX} ${bodyY - height * 0.05} Q ${centerX + width * 0.2} ${bodyY - height * 0.1} ${centerX + width * 0.4} ${bodyY} Z" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Roof - sloping -->
      <path d="M ${centerX - width * 0.25} ${bodyY - height * 0.05} L ${centerX - width * 0.15} ${bodyY - height * 0.15} L ${centerX + width * 0.15} ${bodyY - height * 0.15} L ${centerX + width * 0.25} ${bodyY - height * 0.05} Z" fill="url(#roofGradient)" stroke="#333" stroke-width="2"/>`;

  } else if (bodyStyle === 3) {
    // Sedan style - classic proportions
    svgBody += `
      <!-- Main body - sedan -->
      <ellipse cx="${centerX}" cy="${bodyY}" rx="${width * 0.38}" ry="${height * 0.18}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Trunk -->
      <rect x="${centerX + width * 0.2}" y="${bodyY - height * 0.08}" width="${width * 0.15}" height="${height * 0.12}" rx="${width * 0.02}" fill="${colors.secondary}" stroke="#333" stroke-width="1"/>
      <!-- Roof - standard -->
      <rect x="${centerX - width * 0.22}" y="${bodyY - height * 0.12}" width="${width * 0.44}" height="${height * 0.14}" rx="${width * 0.03}" fill="url(#roofGradient)" stroke="#333" stroke-width="2"/>`;

  } else if (bodyStyle === 4) {
    // Truck style - tall cab and long bed
    svgBody += `
      <!-- Main body - truck cab -->
      <rect x="${centerX - width * 0.25}" y="${bodyY - height * 0.2}" width="${width * 0.3}" height="${height * 0.3}" rx="${width * 0.05}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Bed -->
      <rect x="${centerX - width * 0.4}" y="${bodyY - height * 0.05}" width="${width * 0.5}" height="${height * 0.15}" rx="${width * 0.02}" fill="${colors.secondary}" stroke="#333" stroke-width="2"/>
      <!-- Roof - higher for cab -->
      <rect x="${centerX - width * 0.2}" y="${bodyY - height * 0.25}" width="${width * 0.4}" height="${height * 0.1}" rx="${width * 0.03}" fill="url(#roofGradient)" stroke="#333" stroke-width="2"/>`;

  } else {
    // Convertible style - open roof
    svgBody += `
      <!-- Main body - convertible -->
      <ellipse cx="${centerX}" cy="${bodyY}" rx="${width * (0.4 + random() * 0.05)}" ry="${height * (0.16 + random() * 0.04)}" fill="url(#bodyGradient)" stroke="#333" stroke-width="3"/>
      <!-- Windshield frame -->
      <rect x="${centerX - width * 0.15}" y="${bodyY - height * 0.08}" width="${width * 0.3}" height="${height * 0.02}" fill="#333"/>
      <!-- No roof - open top -->`;
  }

  // Add patterns
  if (pattern === 1) {
    // Stripes
    const stripeCount = 3 + Math.floor(random() * 3);
    for (let i = 0; i < stripeCount; i++) {
      const sy = bodyY - height * 0.15 + (i * height * 0.1);
      svgBody += `<rect x="${centerX - width * 0.4}" y="${sy}" width="${width * 0.8}" height="${height * 0.02}" fill="#FFF" opacity="0.8"/>`;
    }
  } else if (pattern === 2) {
    // Flames
    svgBody += `<path d="M ${centerX - width * 0.2} ${bodyY} Q ${centerX - width * 0.1} ${bodyY - height * 0.1} ${centerX} ${bodyY - height * 0.2} Q ${centerX + width * 0.1} ${bodyY - height * 0.1} ${centerX + width * 0.2} ${bodyY} Z" fill="#FF4500" opacity="0.7"/>`;
  } else if (pattern === 3) {
    // Checkerboard
    const checkSize = width * 0.05;
    for (let x = centerX - width * 0.3; x < centerX + width * 0.3; x += checkSize * 2) {
      for (let y = bodyY - height * 0.15; y < bodyY + height * 0.05; y += checkSize * 2) {
        svgBody += `<rect x="${x}" y="${y}" width="${checkSize}" height="${checkSize}" fill="#000" opacity="0.6"/>`;
        svgBody += `<rect x="${x + checkSize}" y="${y + checkSize}" width="${checkSize}" height="${checkSize}" fill="#000" opacity="0.6"/>`;
      }
    }
  }

  // Add windows based on detail level
  if (detailLevel >= 1) {
    const windowCount = (bodyStyle === 1 || bodyStyle === 4) ? (bodyStyle === 4 ? 5 : 4) : (bodyStyle === 5 ? 1 : 2); // SUVs and trucks have more windows, convertibles have fewer
    for (let i = 0; i < windowCount; i++) {
      const wx = centerX - width * 0.15 + (i * width * 0.15);
      const wy = bodyY - height * (0.1 + random() * 0.05);
      const ww = width * 0.1;
      const wh = height * 0.08;
      svgBody += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${width * 0.01}" fill="#87CEEB" opacity="0.7" stroke="#666" stroke-width="1"/>`;
    }
  }

  // Add headlights/taillights
  const headlightCount = bodyStyle === 0 ? 4 : 2; // Sports cars have more lights
  for (let i = 0; i < headlightCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const offset = headlightCount > 2 ? (i < 2 ? -0.25 : 0.25) : 0;
    const lx = centerX + side * width * (0.15 + offset * 0.1);
    const ly = bodyY + height * (0.05 + random() * 0.03);
    const lr = width * (0.015 + random() * 0.01);
    const color = side < 0 ? '#FFFF00' : '#FF0000'; // Yellow headlights, red taillights
    svgBody += `<circle cx="${lx}" cy="${ly}" r="${lr}" fill="${color}"/>`;
  }

  // Add accessories
  if (accessories === 1) {
    // Spoiler
    let roofTop;
    if (bodyStyle === 0) roofTop = bodyY - height * 0.08;
    else if (bodyStyle === 1) roofTop = bodyY - height * 0.2;
    else if (bodyStyle === 2) roofTop = bodyY - height * 0.15;
    else if (bodyStyle === 3) roofTop = bodyY - height * 0.12;
    else if (bodyStyle === 4) roofTop = bodyY - height * 0.25;
    else roofTop = bodyY - height * 0.08; // convertible
    svgBody += `<rect x="${centerX - width * 0.25}" y="${roofTop - height * 0.02}" width="${width * 0.5}" height="${height * 0.02}" rx="${width * 0.01}" fill="#333"/>`;
  } else if (accessories === 2) {
    // Exhaust pipes
    svgBody += `<ellipse cx="${centerX - width * 0.35}" cy="${bodyY + height * 0.03}" rx="${width * 0.02}" ry="${height * 0.01}" fill="#666"/>`;
    svgBody += `<ellipse cx="${centerX + width * 0.35}" cy="${bodyY + height * 0.03}" rx="${width * 0.02}" ry="${height * 0.01}" fill="#666"/>`;
  }

  // Add details based on detail level
  if (detailLevel >= 2) {
    // Add grille or bumper details
    svgBody += `<rect x="${centerX - width * 0.08}" y="${bodyY + height * 0.02}" width="${width * 0.16}" height="${height * 0.04}" rx="${width * 0.01}" fill="#333" opacity="0.8"/>`;

    // Add side mirrors
    svgBody += `<ellipse cx="${centerX - width * 0.35}" cy="${bodyY - height * 0.05}" rx="${width * 0.02}" ry="${height * 0.015}" fill="#333"/>`;
    svgBody += `<ellipse cx="${centerX + width * 0.35}" cy="${bodyY - height * 0.05}" rx="${width * 0.02}" ry="${height * 0.015}" fill="#333"/>`;
  }

  svgBody += '</svg>';

  return await sharp(Buffer.from(svgBody)).png().toBuffer();
}

// Generate diverse wheel designs
async function generateWheel(width, height, random) {
  const sharp = (await import('sharp')).default;

  // Randomize wheel design parameters
  const rimStyle = Math.floor(random() * 6); // 0-5 rim styles
  const spokePattern = Math.floor(random() * 6); // 0-5 spoke patterns
  const colorScheme = Math.floor(random() * 6); // 0-5 color schemes

  // Color schemes for wheels
  const colorSchemes = [
    { rim: '#C0C0C0', tire: '#333', spokes: '#888' }, // Chrome and black
    { rim: '#FFD700', tire: '#222', spokes: '#FFA500' }, // Gold and black
    { rim: '#B87333', tire: '#666', spokes: '#8B4513' }, // Bronze and dark
    { rim: '#FF1493', tire: '#333', spokes: '#8A2BE2' }, // Neon pink
    { rim: '#00FF00', tire: '#222', spokes: '#FFFF00' }, // Lime
    { rim: '#DC143C', tire: '#666', spokes: '#F0E68C' }  // Crimson
  ];

  const colors = colorSchemes[colorScheme];

  let svgWheel = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tireGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${colors.tire};stop-opacity:1" />
        <stop offset="70%" style="stop-color:#666;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#000;stop-opacity:1" />
      </radialGradient>
      <radialGradient id="rimGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#FFF;stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors.rim};stop-opacity:1" />
      </radialGradient>
    </defs>`;

  const centerX = width / 2;
  const centerY = height / 2;
  const tireRadius = width * (0.45 + random() * 0.05);
  const rimRadius = width * (0.25 + random() * 0.05);

  // Outer tire
  svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${tireRadius}" fill="url(#tireGradient)" stroke="#222" stroke-width="2"/>`;

  // Tire tread pattern
  const treadCount = 8 + Math.floor(random() * 8);
  for (let i = 0; i < treadCount; i++) {
    const angle = (i / treadCount) * Math.PI * 2;
    const innerR = tireRadius * 0.85;
    const outerR = tireRadius * 0.95;
    const x1 = centerX + Math.cos(angle) * innerR;
    const y1 = centerY + Math.sin(angle) * innerR;
    const x2 = centerX + Math.cos(angle) * outerR;
    const y2 = centerY + Math.sin(angle) * outerR;
    svgWheel += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1"/>`;
  }

  // Inner rim
  if (rimStyle === 0) {
    // Multi-piece rim
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius}" fill="url(#rimGradient)" stroke="#888" stroke-width="1"/>`;
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius * 0.7}" fill="${colors.rim}" stroke="#666" stroke-width="1"/>`;
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius * 0.4}" fill="#FFF" stroke="#CCC" stroke-width="1"/>`;

  } else if (rimStyle === 1) {
    // Mesh style rim
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius}" fill="url(#rimGradient)" stroke="#888" stroke-width="1"/>`;
    // Add mesh pattern
    const meshLines = 12 + Math.floor(random() * 8);
    for (let i = 0; i < meshLines; i++) {
      const angle = (i / meshLines) * Math.PI * 2;
      const x1 = centerX + Math.cos(angle) * (rimRadius * 0.3);
      const y1 = centerY + Math.sin(angle) * (rimRadius * 0.3);
      const x2 = centerX + Math.cos(angle) * (rimRadius * 0.9);
      const y2 = centerY + Math.sin(angle) * (rimRadius * 0.9);
      svgWheel += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.spokes}" stroke-width="2"/>`;
    }

  } else if (rimStyle === 2) {
    // Split rim
    const splitAngle = random() * Math.PI * 2;
    svgWheel += `<path d="M ${centerX + Math.cos(splitAngle) * rimRadius} ${centerY + Math.sin(splitAngle) * rimRadius} A ${rimRadius} ${rimRadius} 0 1 1 ${centerX + Math.cos(splitAngle + Math.PI) * rimRadius} ${centerY + Math.sin(splitAngle + Math.PI) * rimRadius} L ${centerX} ${centerY} Z" fill="url(#rimGradient)" stroke="#888" stroke-width="1"/>`;
    svgWheel += `<path d="M ${centerX + Math.cos(splitAngle + Math.PI) * rimRadius} ${centerY + Math.sin(splitAngle + Math.PI) * rimRadius} A ${rimRadius} ${rimRadius} 0 1 1 ${centerX + Math.cos(splitAngle) * rimRadius} ${centerY + Math.sin(splitAngle) * rimRadius} L ${centerX} ${centerY} Z" fill="${colors.rim}" stroke="#888" stroke-width="1"/>`;

  } else if (rimStyle === 4) {
    // Hexagonal rim
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * rimRadius;
      const y = centerY + Math.sin(angle) * rimRadius;
      hexPoints.push(`${x},${y}`);
    }
    svgWheel += `<polygon points="${hexPoints.join(' ')}" fill="url(#rimGradient)" stroke="#888" stroke-width="1"/>`;

  } else if (rimStyle === 5) {
    // Star-shaped rim
    const starPoints = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = i % 2 === 0 ? rimRadius : rimRadius * 0.5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      starPoints.push(`${x},${y}`);
    }
    svgWheel += `<polygon points="${starPoints.join(' ')}" fill="url(#rimGradient)" stroke="#888" stroke-width="1"/>`;

  } else {
    // Simple single-piece rim
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius}" fill="url(#rimGradient)" stroke="#888" stroke-width="2"/>`;
    // Center cap
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius * 0.3}" fill="#FFF" stroke="#CCC" stroke-width="1"/>`;
  }

  // Add spokes based on pattern
  if (spokePattern === 0) {
    // Cross pattern
    svgWheel += `<line x1="${centerX}" y1="${centerY - rimRadius * 0.8}" x2="${centerX}" y2="${centerY + rimRadius * 0.8}" stroke="${colors.spokes}" stroke-width="4"/>`;
    svgWheel += `<line x1="${centerX - rimRadius * 0.8}" y1="${centerY}" x2="${centerX + rimRadius * 0.8}" y2="${centerY}" stroke="${colors.spokes}" stroke-width="4"/>`;

  } else if (spokePattern === 1) {
    // Star pattern
    const spokeCount = 5 + Math.floor(random() * 3);
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2;
      const x1 = centerX + Math.cos(angle) * (rimRadius * 0.2);
      const y1 = centerY + Math.sin(angle) * (rimRadius * 0.2);
      const x2 = centerX + Math.cos(angle) * (rimRadius * 0.9);
      const y2 = centerY + Math.sin(angle) * (rimRadius * 0.9);
      svgWheel += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.spokes}" stroke-width="3"/>`;
    }

  } else if (spokePattern === 2) {
    // V pattern
    const vCount = 3 + Math.floor(random() * 2);
    for (let i = 0; i < vCount; i++) {
      const angle = (i / vCount) * Math.PI * 2;
      const x1 = centerX + Math.cos(angle) * (rimRadius * 0.3);
      const y1 = centerY + Math.sin(angle) * (rimRadius * 0.3);
      const x2 = centerX + Math.cos(angle + Math.PI/vCount) * (rimRadius * 0.3);
      const y2 = centerY + Math.sin(angle + Math.PI/vCount) * (rimRadius * 0.3);
      const x3 = centerX + Math.cos(angle + Math.PI/(vCount*2)) * (rimRadius * 0.9);
      const y3 = centerY + Math.sin(angle + Math.PI/(vCount*2)) * (rimRadius * 0.9);
      svgWheel += `<line x1="${x1}" y1="${y1}" x2="${x3}" y2="${y3}" stroke="${colors.spokes}" stroke-width="3"/>`;
      svgWheel += `<line x1="${x2}" y1="${y2}" x2="${x3}" y2="${y3}" stroke="${colors.spokes}" stroke-width="3"/>`;
    }

  } else if (spokePattern === 3) {
    // Curved spokes
    const curveCount = 6 + Math.floor(random() * 4);
    for (let i = 0; i < curveCount; i++) {
      const angle = (i / curveCount) * Math.PI * 2;
      const startAngle = angle - Math.PI/(curveCount*2);
      const endAngle = angle + Math.PI/(curveCount*2);

      const x1 = centerX + Math.cos(startAngle) * (rimRadius * 0.3);
      const y1 = centerY + Math.sin(startAngle) * (rimRadius * 0.3);
      const x2 = centerX + Math.cos(endAngle) * (rimRadius * 0.9);
      const y2 = centerY + Math.sin(endAngle) * (rimRadius * 0.9);

      // Create curved path
      const midAngle = (startAngle + endAngle) / 2;
      const midRadius = rimRadius * 0.6;
      const cx = centerX + Math.cos(midAngle) * midRadius;
      const cy = centerY + Math.sin(midAngle) * midRadius;

      svgWheel += `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" stroke="${colors.spokes}" stroke-width="3" fill="none"/>`;
    }

  } else if (spokePattern === 5) {
    // Zigzag pattern
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x1 = centerX + Math.cos(angle) * (rimRadius * 0.2);
      const y1 = centerY + Math.sin(angle) * (rimRadius * 0.2);
      const x2 = centerX + Math.cos(angle + Math.PI/16) * (rimRadius * 0.6);
      const y2 = centerY + Math.sin(angle + Math.PI/16) * (rimRadius * 0.6);
      const x3 = centerX + Math.cos(angle - Math.PI/16) * (rimRadius * 0.9);
      const y3 = centerY + Math.sin(angle - Math.PI/16) * (rimRadius * 0.9);
      svgWheel += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.spokes}" stroke-width="3"/>`;
      svgWheel += `<line x1="${x2}" y1="${y2}" x2="${x3}" y2="${y3}" stroke="${colors.spokes}" stroke-width="3"/>`;
    }

  } else {
    // Minimal/no spokes
    // Just add center logo
    svgWheel += `<circle cx="${centerX}" cy="${centerY}" r="${rimRadius * 0.1}" fill="${colors.spokes}"/>`;
  }

  svgWheel += '</svg>';

  return await sharp(Buffer.from(svgWheel)).png().toBuffer();
}
