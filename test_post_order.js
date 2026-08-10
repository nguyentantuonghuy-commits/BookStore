const http = require('http');

const postData = JSON.stringify({
  userId: "cus8",
  items: [
    {
      id: "test_item",
      title: "Test Book",
      price: 50000,
      quantity: 1
    }
  ],
  total: 50000,
  status: "Đang xử lý",
  isNew: true,
  fullname: "Test Customer",
  phone: "0123456789",
  email: "nguyentantuonghuy2686@gmail.com",
  address: "Test Address",
  createdAt: new Date().toISOString()
});

const postOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', err => reject(err));
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function test() {
  try {
    console.log('Sending POST /orders...');
    const postRes = await makeRequest(postOptions, postData);
    console.log('POST Response Status:', postRes.statusCode);
    console.log('Created Order:', postRes.body);

    const getOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/orders',
      method: 'GET'
    };

    console.log('Fetching GET /orders immediately...');
    const getRes1 = await makeRequest(getOptions);
    console.log('Total orders immediately:', getRes1.body.length);
    const found1 = getRes1.body.find(o => o.userId === 'cus8');
    console.log('Found order immediately?', found1 ? 'YES' : 'NO');

    console.log('Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Fetching GET /orders after 5 seconds...');
    const getRes2 = await makeRequest(getOptions);
    console.log('Total orders after 5s:', getRes2.body.length);
    const found2 = getRes2.body.find(o => o.userId === 'cus8');
    console.log('Found order after 5s?', found2 ? 'YES' : 'NO');

  } catch (e) {
    console.error('Error during test:', e);
  }
}

test();
