const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const targetUrl = 'http://localhost:3000/';
  const artifactDir = 'C:\\Users\\opc\\.gemini\\antigravity\\brain\\e0647dad-0f25-45b6-ba6c-6fe72dd9d18d\\scratch\\';
  
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const viewports = [
    { width: 390, height: 844, name: 'mobile_390x844' },
    { width: 430, height: 932, name: 'mobile_430x932' },
    { width: 1366, height: 768, name: 'desktop_1366x768' },
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    
    const screenshotPath = `${artifactDir}screenshot_${vp.name}.jpg`;
    await page.screenshot({ path: screenshotPath, fullPage: true, quality: 80 });
    console.log(`Saved ${screenshotPath}`);
  }

  await browser.close();
})();
