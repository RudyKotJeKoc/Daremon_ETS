const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

if (htmlContent.includes('id="loaderOverlay"')) {
  console.error('Loader overlay markup still present in index.html');
  process.exit(1);
}

console.log('Loader overlay markup removed successfully.');
