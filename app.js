const puppeteer = require('puppeteer');
const fs = require('fs');

// load github login info from file
const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const repoList = [
  'cheeriojs/cheerio',
  'axios/axios',
  'puppeteer/puppeteer',
];

(async () => {
  const browser = await puppeteer.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();

  // go to github and log in
  await page.goto('https://github.com/login');
  await page.type('#login_field', creds.username);
  await page.type('#password', creds.password);
  await page.click('[name="commit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // grab the logged-in username from the page meta
  const ghUser = await page.$eval(
    'meta[name="octolytics-actor-login"]',
    (el) => el.content
  );

  // star each repo
  for (const repo of repoList) {
    await page.goto(`https://github.com/${repo}`);
    await page.waitForSelector('.js-toggler-target.BtnGroup-item');
    await page.click('.js-toggler-target.BtnGroup-item');
    await delay(1000);
  }

  // go to starred repos page and create a new list
  await page.goto(`https://github.com/${ghUser}?tab=stars`);
  await page.waitForSelector('.Button--primary.Button--medium.Button');
  await page.click('.Button--primary.Button--medium.Button');

  // fill in the list name
  await page.waitForSelector('#user_list_name');
  await page.type('#user_list_name', 'Node Libraries');
  await delay(2000);

  // find the "Create" button and click it
  const allBtns = await page.$$('.Button--primary.Button--medium.Button');
  for (const btn of allBtns) {
    const txt = await btn.evaluate((el) => el.textContent.trim());
    if (txt === 'Create') {
      await btn.evaluate((b) => b.click());
      break;
    }
  }
  await delay(2000);

  // now add each repo to the "Node Libraries" list
  const menuToggle = 'details.js-user-list-menu summary';

  for (const repo of repoList) {
    await page.goto(`https://github.com/${repo}`);

    await page.waitForSelector(menuToggle);
    await page.click(menuToggle);
    await page.waitForSelector('.SelectMenu');

    const items = await page.$$('.js-user-list-menu-item');
    for (const item of items) {
      const lbl = await item.evaluateHandle((el) => el.closest('label'));
      const lblText = await lbl.evaluate((el) => el.innerText);
      if (lblText.includes('Node Libraries')) {
        await lbl.evaluate((el) => el.click());
        break;
      }
    }

    await delay(1000);

    // close the dropdown
    await page.evaluate((sel) => {
      document.querySelector(sel).closest('details').removeAttribute('open');
    }, menuToggle);
  }

  await browser.close();
})();
