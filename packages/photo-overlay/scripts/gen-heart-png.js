const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const HEART_PATH_DATA =
  'M 10 6 C 10 2, 5 0, 2 3 C -1 6, -1 10, 5 15 C 8 18, 10 20,10 20 C 10 20, 12 18, 15 15 C 21 10, 21 6, 18 3 C 15 0, 10 2, 10 6 Z';

const svg =
  '<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
  '<path fill="#d9534f" d="' + HEART_PATH_DATA + '"/>' +
  '</svg>';

// Genero anche versione 200x200 (alta risoluzione, scalata via <image width>)
sharp(Buffer.from(
  '<svg width="200" height="200" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
  '<path fill="#d9534f" d="' + HEART_PATH_DATA + '"/>' +
  '</svg>'
)).png().toBuffer().then(buf => {
  const b64 = buf.toString('base64');
  console.log('PNG 200x200 size bytes:', buf.length, 'b64 len:', b64.length);
  fs.writeFileSync(path.join(__dirname, 'heart-200-base64.txt'), b64);
  return sharp(Buffer.from(
    '<svg width="64" height="64" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
    '<path fill="#d9534f" d="' + HEART_PATH_DATA + '"/>' +
    '</svg>'
  )).png().toBuffer();
}).then(buf => {
  const b64 = buf.toString('base64');
  console.log('PNG size bytes:', buf.length);
  console.log('PNG base64 length:', b64.length);
  console.log('PNG base64 first 100:', b64.slice(0, 100));
  fs.writeFileSync(path.join(__dirname, 'heart-base64.txt'), b64);
  fs.writeFileSync(path.join(__dirname, 'heart.png'), buf);
  console.log('OK scritto in', __dirname);
}).catch(err => { console.error('ERR:', err); });
