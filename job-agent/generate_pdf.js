const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const htmlPath = path.join(__dirname, '方案说明书.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: '方案说明书.pdf',
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  });
  
  console.log('PDF generated: 方案说明书.pdf');
  await browser.close();
})();
