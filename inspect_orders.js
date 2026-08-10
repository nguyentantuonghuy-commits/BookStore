const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'email-server', 'db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const orders = db.orders || [];
  console.log('Total orders:', orders.length);
  const userCounts = {};
  orders.forEach(o => {
    userCounts[o.userId] = (userCounts[o.userId] || 0) + 1;
  });
  console.log('Orders per userId:', userCounts);
  console.log('List of orders:', orders.map(o => ({ id: o.id, userId: o.userId, createdAt: o.createdAt })));
} else {
  console.log('File not found:', dbPath);
}
