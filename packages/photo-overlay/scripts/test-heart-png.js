const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  const b64 = fs.readFileSync(path.join(__dirname, 'heart-base64.txt'), 'utf8');

  // Test 1: render di un SVG con <image href=base64> per cuori a varie dimensioni
  const sizes = [20, 40, 60, 100];
  for (const s of sizes) {
    const svg =
      '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="200" height="200" fill="white"/>' +
      '<image x="' + (100 - s/2) + '" y="' + (100 - s/2) + '" width="' + s + '" height="' + s + '" href="data:image/png;base64,' + b64 + '"/>' +
      '</svg>';
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let redCount = 0;
    for (let i = 0; i + 2 < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 200 && g < 120 && b < 120) redCount++;
    }
    console.log('size=' + s + 'px: Rossi=' + redCount + ' (canvas ' + info.width + 'x' + info.height + ')');
  }

  // Test 2: polaroid complessivo - foto grigia + watermark con cuore via image + text
  const HEART_PNG_B64 = b64;
  const textSvg =
    '<svg width="480" height="640" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="480" height="640" fill="#cccccc"/>' +
    '<text x="20" y="620" font-family="serif" font-size="50" fill="#000000">Agostino </text>' +
    '<image x="180" y="580" width="50" height="50" href="data:image/png;base64,' + HEART_PNG_B64 + '"/>' +
    '<text x="240" y="620" font-family="serif" font-size="50" fill="#000000"> Danila</text>' +
    '</svg>';
  const finalBuf = await sharp(Buffer.from(textSvg)).png().toBuffer();
  const { data, info } = await sharp(finalBuf).raw().toBuffer({ resolveWithObject: true });
  let redCount = 0;
  for (let i = 0; i + 2 < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 200 && g < 120 && b < 120) redCount++;
  }
  console.log('Composite test: Rossi totali =', redCount);
})();
