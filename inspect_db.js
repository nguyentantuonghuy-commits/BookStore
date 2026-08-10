const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'email-server', 'db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log('--- All Keys in db.json ---');
  for (let k of Object.keys(db)) {
    console.log(`Key "${k}": type=${typeof db[k]}, isArray=${Array.isArray(db[k])}, length=${Array.isArray(db[k]) ? db[k].length : 'N/A'}`);
  }
} else {
  console.log('File not found:', dbPath);
}
