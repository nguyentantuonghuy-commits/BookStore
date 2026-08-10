const fs = require('fs');
const path = require('path');

const DB_FILE_PATH = path.join(__dirname, 'email-server', 'secure_db.txt');

function decrypt(data) {
  if (!data) return data;
  const trimmed = data.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return data;
  }
  try {
    const key = 'sachweb_secret_key_2026';
    const binary = Buffer.from(data, 'base64').toString('binary');
    const xorBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      xorBytes[i] = binary.charCodeAt(i);
    }
    const keyBytes = Buffer.from(key, 'utf8');
    const dataBytes = new Uint8Array(xorBytes.length);
    for (let i = 0; i < xorBytes.length; i++) {
      dataBytes[i] = xorBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return Buffer.from(dataBytes).toString('utf8');
  } catch (e) {
    console.error('Decryption error:', e);
    return data;
  }
}

if (fs.existsSync(DB_FILE_PATH)) {
  const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
  const decrypted = decrypt(data);
  try {
    const parsed = JSON.parse(decrypted);
    console.log('--- Orders in secure_db.txt ---');
    console.log(JSON.stringify(parsed.order, null, 2));
  } catch (e) {
    console.log('Failed to parse JSON:', e);
  }
} else {
  console.log('File not found:', DB_FILE_PATH);
}
