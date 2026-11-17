#!/usr/bin/env node
/** 看谱顶栏 ModeSwitch 不得整行拉满；播放运输条不得接近全宽。 */
import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture } from './fixtures/parts-audio.mjs';

const repo = join(fileURLToPath(import.meta.url), '../..');
const root = join(repo, 'app/dist');
const out = join(repo, 'tests/results/score-chrome-islands');
mkdirSync(out, { recursive: true });
if (!existsSync(join(root, 'index.html'))) {
  console.error('FAIL: app/dist missing');
  process.exit(1);
}

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(root, decodeURIComponent(path.replace(/^\//, '')));
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404);
    res.end('missing');
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/`;

const width = 390;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true });
const failures = [];

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-tabbar', { timeout: 20000 });

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入乐谱', exact: true }).click();
  await (await chooser).setFiles({
    name: 'independent.musicxml',
    mimeType: 'application/vnd.recordare.musicxml+xml',
    buffer: Buffer.from(fixture),
  });
  await page.locator('.score-chrome, .reader').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(800);

  const chrome = page.locator('.score-chrome');
  await chrome.waitFor({ timeout: 15000 });
  const mode = page.locator('.score-chrome .mode-switch');
  const chromeBox = await chrome.boundingBox();
  const modeBox = await mode.boundingBox();
  await page.screenshot({ path: join(out, 'reader-chrome.png') });
  writeFileSync(
    join(out, 'reader.json'),
    JSON.stringify({ chromeBox, modeBox, viewport: width }, null, 2),
  );

  if (!chromeBox || !modeBox) failures.push('missing chrome/mode boxes');
  else {
    // ModeSwitch 不得占满整行（旧 bug：flex-basis 100%）
    if (modeBox.width > width * 0.72) failures.push(`mode-switch too wide: ${modeBox.width}`);
    if (modeBox.y - chromeBox.y > 40) failures.push(`mode-switch wrapped to second row (dy=${modeBox.y - chromeBox.y})`);
  }

  await page.getByRole('radio', { name: '播放', exact: true }).click();
  await page.locator('.transport').waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  const transport = await page.locator('.transport').boundingBox();
  await page.screenshot({ path: join(out, 'player-transport.png') });
  writeFileSync(join(out, 'player.json'), JSON.stringify({ transport }, null, 2));
  if (!transport) failures.push('missing transport');
  else if (transport.width > Math.min(560, width - 8) + 2) {
    failures.push(`transport too wide: ${transport.width}`);
  } else if (transport.width > width - 24) {
    failures.push(`transport near full-bleed: ${transport.width}`);
  }

  console.log(
    JSON.stringify(
      {
        chromeH: chromeBox?.height,
        modeW: modeBox?.width,
        modeDy: modeBox && chromeBox ? modeBox.y - chromeBox.y : null,
        transportW: transport?.width,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error('FAIL', failures);
  process.exit(1);
}
console.log('PASS score chrome islands stay compact');
