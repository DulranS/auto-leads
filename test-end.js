// Test to see the end of the file
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\dulra\\auto-leads\\scrape-mails\\app\\dashboard\\page.js', 'utf8');
const lines = content.split('\n');
console.log('Last 5 lines:');
lines.slice(-5).forEach((line, i) => {
  console.log(`${lines.length - 5 + i + 1}: "${line}"`);
});
console.log('\nLast 50 characters:');
console.log(`"${content.slice(-50)}"`);
