const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'email-server', 'db.json');
console.log('Watching db.json at:', dbPath);

let lastContent = '';
if (fs.existsSync(dbPath)) {
  lastContent = fs.readFileSync(dbPath, 'utf8');
}

fs.watchFile(dbPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    console.log(`\n--- db.json modified at ${new Date().toISOString()} ---`);
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      try {
        const db = JSON.parse(content);
        const lastDb = lastContent ? JSON.parse(lastContent) : {};
        
        console.log('Top-level keys lengths:');
        for (let k of Object.keys(db)) {
          const prevLen = Array.isArray(lastDb[k]) ? lastDb[k].length : 0;
          const currLen = Array.isArray(db[k]) ? db[k].length : 0;
          if (prevLen !== currLen) {
            console.log(`Key "${k}": length changed from ${prevLen} to ${currLen}`);
          }
        }
        
        // Show differences in orders if changed
        const prevOrders = lastDb.orders || [];
        const currOrders = db.orders || [];
        if (prevOrders.length !== currOrders.length) {
          console.log(`Orders count: ${prevOrders.length} -> ${currOrders.length}`);
          if (currOrders.length > prevOrders.length) {
            console.log('Added orders:', currOrders.slice(prevOrders.length));
          } else {
            console.log('Deleted or replaced orders.');
          }
        }
        
        lastContent = content;
      } catch (e) {
        console.log('Failed to parse json:', e.message);
      }
    }
  }
});
