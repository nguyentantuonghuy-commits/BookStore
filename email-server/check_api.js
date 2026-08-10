const http = require('http');

http.get('http://localhost:3000/customers', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data.substring(0, 1000));
  });
}).on('error', (err) => {
  console.error('ERROR:', err.message);
});
