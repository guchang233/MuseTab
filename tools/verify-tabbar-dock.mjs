#!/usr/bin/env node
/** 底栏四标签必须是居中封顶悬浮岛，不得随屏宽左右拉满。 */
import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '../..');
const root = join(repo, 'app/dist');
if (!existsSync(join(root, 'index.html'))) {
  console.error('FAIL: app/dist missing — run npm run build first');
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
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(root, path.replace(/^\//, ''));
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

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const width of [390, 768, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-tabbar', { timeout: 20000 });
  const box = await page.locator('.app-tabbar').boundingBox();
  if (!box) {
    failures.push(`${width}: no tabbar box`);
    await page.close();
    continue;
  }
  const maxAllowed = Math.min(360, width - 24) + 1;
  const centered = Math.abs(box.x + box.width / 2 - width / 2) < 2;
  const capped = box.width <= maxAllowed;
  const notFullBleed = box.width < width - 20;
  console.log(
    JSON.stringify({
      width,
      tabbar: { x: box.x, w: box.width, centered, capped, notFullBleed },
    }),
  );
  if (!centered) failures.push(`${width}: not centered`);
  if (!capped) failures.push(`${width}: wider than min(360, vw-24) (${box.width})`);
  if (!notFullBleed) failures.push(`${width}: still near full-bleed`);
  await page.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error('FAIL', failures);
  process.exit(1);
}
console.log('PASS tabbar is a centered capped dock');
