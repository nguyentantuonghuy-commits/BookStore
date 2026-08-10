const fs = require('fs');
const content = fs.readFileSync('server_log.txt', 'utf16le');
const lines = content.split('\n');
const reqResLines = lines.filter(l => l.includes('[Request') || l.includes('[Response'));
console.log('Total request/response lines:', reqResLines.length);
reqResLines.slice(-60).forEach(l => console.log(l.trim()));
