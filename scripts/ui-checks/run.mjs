// Behaviour checks for the public UI. Needs the API (default :5000) and the built frontend served on :4173
// (`npm run build --workspace=frontend && npx vite preview --port 4173` inside frontend/). Read-only: it never
// signs in and never writes. Usage: npm run ui:check [-- --list] [-- --only 3,4]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:4173';
const API = process.env.API || 'http://localhost:5000/api/v1';
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const only = arg('only')?.split(',').map(Number);

/** Chromium: PLAYWRIGHT_EXECUTABLE_PATH, else the newest one Playwright already downloaded on this machine. */
function findChrome() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const roots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'), process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const get = async (p) => { const r = await fetch(API + p); if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json(); };
const VP = { desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 } };
const ok = (label, pass, detail = '') => ({ label, pass, detail });
const settle = async (page) => { // wait until the scroll position stops moving (Lenis glides)
  let last = -1, same = 0;
  for (let i = 0; i < 50 && same < 4; i++) { const y = await page.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; await page.waitForTimeout(80); }
  return last;
};
async function open(browser, vp = 'desktop', url = '/') {
  const ctx = await browser.newContext({ viewport: VP[vp], hasTouch: vp === 'mobile' });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

const CASES = [
  // 1
  ['dialog: focus trap, Esc, page frozen behind, scrolls inside', async (browser) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 420 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.mouse.wheel(0, 1200); const y0 = await settle(page);
    await page.getByRole('button', { name: /sign in/i }).first().click(); await page.waitForTimeout(600);
    await page.getByRole('tab', { name: /register/i }).click().catch(() => {}); await page.waitForTimeout(300);
    const inside = [];
    for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); inside.push(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]'))); }
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); inside.push(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]'))); }
    await page.mouse.move(8, 8); await page.mouse.wheel(0, 600); await page.waitForTimeout(600);
    const yBackdrop = await page.evaluate(() => Math.round(scrollY));
    const box = await page.locator('.cf-dialog__body').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 300); await page.waitForTimeout(600);
    const inner = await page.evaluate(() => ({ y: Math.round(scrollY), top: Math.round(document.querySelector('.cf-dialog__body').scrollTop) }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const closed = (await page.getByRole('dialog').count()) === 0;
    const back = await page.evaluate(() => document.activeElement?.innerText?.trim());
    await page.mouse.move(700, 200); await page.mouse.wheel(0, 400); await page.waitForTimeout(900);
    const yAfter = await page.evaluate(() => Math.round(scrollY));
    await ctx.close();
    return [
      ok('Tab and Shift+Tab stay inside the dialog', inside.every(Boolean), `${inside.filter(Boolean).length}/${inside.length}`),
      ok('wheel on the backdrop does not move the page', yBackdrop === y0, `${y0} -> ${yBackdrop}`),
      ok('wheel inside the dialog scrolls the dialog, not the page', inner.top > 0 && inner.y === y0, `dialog ${inner.top}, page ${inner.y}`),
      ok('Esc closes and focus returns to Sign in', closed && /sign in/i.test(back || ''), `closed=${closed} focus="${back}"`),
      ok('page scrolls again after close', yAfter > y0, `${y0} -> ${yAfter}`),
    ];
  }],
  // 2
  ['landing page returns to its place after opening an item', async (browser) => {
    const out = [];
    for (const vp of ['desktop', 'mobile']) {
      for (const how of ['browser back', 'Registry link']) {
        const rows = [];
        for (let run = 1; run <= 3; run++) {
          const { ctx, page } = await open(browser, vp);
          await page.getByRole('button', { name: /^Browse \d+ skills$/ }).click(); await page.waitForTimeout(1500);
          const next = page.getByRole('button', { name: /next/i });
          if (await next.count()) { await next.first().click(); await page.waitForTimeout(1000); }
          await page.mouse.wheel(0, 400 + run * 130); await page.waitForTimeout(1200);
          const card = page.locator('.cf-card').nth(1);
          await card.locator('.cf-card__desc').evaluate((e) => e.scrollIntoView({ block: 'center' }));
          const y0 = await settle(page);
          const tab0 = await page.evaluate(() => document.querySelector('.cf-tabs [aria-selected=true]')?.innerText.replace(/\s+/g, ' '));
          const pager0 = await page.evaluate(() => document.querySelector('.pager, [aria-label*=agination]')?.innerText.replace(/\s+/g, ' '));
          const d = await card.locator('.cf-card__desc').boundingBox();
          await page.mouse.click(d.x + 20, d.y + d.height / 2); await page.waitForTimeout(1300);
          if (!(await page.evaluate(() => location.hash.startsWith('#/skills/')))) { await ctx.close(); continue; } // click missed: not counted
          if (how === 'browser back') await page.goBack(); else await page.locator('.back-link').click();
          await page.waitForTimeout(1800);
          const y1 = await page.evaluate(() => Math.round(scrollY));
          const tab1 = await page.evaluate(() => document.querySelector('.cf-tabs [aria-selected=true]')?.innerText.replace(/\s+/g, ' '));
          const pager1 = await page.evaluate(() => document.querySelector('.pager, [aria-label*=agination]')?.innerText.replace(/\s+/g, ' '));
          rows.push(Math.abs(y1 - y0) <= 6 && tab1 === tab0 && pager1 === pager0);
          await ctx.close();
        }
        out.push(ok(`${vp}, ${how}`, rows.length >= 2 && rows.every(Boolean), `${rows.filter(Boolean).length}/${rows.length} runs restored`));
      }
    }
    return out;
  }],
  // 3
  ['jump buttons move keyboard focus to the registry', async (browser) => {
    const { ctx, page } = await open(browser);
    await page.getByRole('button', { name: /^Browse \d+ skills$/ }).focus();
    await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    const a = await page.evaluate(() => ({ inside: !!document.activeElement.closest('#browse'), y: Math.round(scrollY) }));
    await page.keyboard.press('Tab'); await page.waitForTimeout(700);
    const b = await page.evaluate(() => ({ inside: !!document.activeElement.closest('#browse'), y: Math.round(scrollY) }));
    await ctx.close();
    return [ok('focus is inside #browse after Enter', a.inside), ok('next Tab stays in the registry and the page does not jump back', b.inside && Math.abs(b.y - a.y) < 400, `scrollY ${a.y} -> ${b.y}`)];
  }],
  // 4
  ['full-page states have exactly one h1', async (browser) => {
    const { ctx, page } = await open(browser);
    const out = [];
    for (const [name, hash] of [['workspace, signed out', '#/workspace/servers'], ['admin, signed out', '#/admin'], ['unknown server', '#/servers/00000000-0000-4000-8000-000000000000'], ['invalid id', '#/servers/not-a-uuid'], ['unknown route', '#/nope']]) {
      await page.goto(BASE + '/' + hash); await page.waitForTimeout(1300);
      const n = await page.evaluate(() => document.querySelectorAll('h1').length);
      out.push(ok(name, n === 1, `h1 count ${n}`));
    }
    await ctx.close();
    return out;
  }],
  // 5
  ['phone layout: footer clear of the dock, no sideways scroll, API docs reachable', async (browser) => {
    const { ctx, page } = await open(browser, 'mobile');
    const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const docs = await page.evaluate(() => [...document.querySelectorAll('a')].filter((e) => /api docs/i.test(e.innerText) && e.offsetParent !== null).length);
    const signIn = await page.evaluate(() => [...document.querySelectorAll('a,button')].filter((e) => /^sign in$/i.test(e.innerText.trim()) && e.offsetParent !== null && getComputedStyle(e).display !== 'none').length);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(900);
    const g = await page.evaluate(() => ({ dock: Math.round(document.querySelector('nav.dock').getBoundingClientRect().top), foot: Math.round([...document.querySelectorAll('.site-foot span')].pop().getBoundingClientRect().bottom) }));
    await ctx.close();
    return [ok('no horizontal overflow at 375px', hOverflow === 0, `${hOverflow}px`), ok('API docs visible', docs === 1, `${docs}`), ok('Sign in appears once', signIn === 1, `${signIn}`), ok('last footer line above the dock', g.foot <= g.dock, `foot ${g.foot} <= dock ${g.dock}`)];
  }],
  // 6
  ['stand-alone controls are at least 24px tall (WCAG 2.5.8)', async (browser) => {
    const servers = (await get('/servers?limit=100')).data;
    const richest = [...servers].sort((a, b) => b.tools.length - a.tools.length)[0]; // the long repository link wraps differently here
    const skills = (await get('/skills?limit=1')).data;
    const pages = [['home', '/'], ['server detail (most tools)', `/#/servers/${richest.id}`], ['skill detail', `/#/skills/${skills[0].id}`]];
    const out = [];
    for (const [name, url] of pages) {
      const { ctx, page } = await open(browser, 'desktop', url); await page.waitForTimeout(800);
      const small = await page.evaluate(() => [...document.querySelectorAll('a,button,input,select,summary,textarea')].filter((e) => {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.offsetParent === null) return false;
        if (r.height >= 24) return false;
        if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.parentElement && e.parentElement.innerText.length > e.innerText.length + 8) return false; // link inside a sentence is exempt
        return true;
      }).map((e) => `${(e.innerText || e.tagName).trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().height)}px`));
      out.push(ok(name, small.length === 0, small.slice(0, 3).join('; ')));
      await ctx.close();
    }
    return out;
  }],
  // 7
  ['lanes show a sample and the totals match the API', async (browser) => {
    const all = []; for (let p = 1; p <= 20; p++) { const r = await get(`/servers?limit=100&page=${p}`); all.push(...r.data); if (p >= r.pagination.totalPages) break; }
    const tools = all.reduce((n, s) => n + (s.tools || []).length, 0);
    const { ctx, page } = await open(browser);
    const m = await page.evaluate(() => ({ tiles: [...document.querySelectorAll('.lane')].map((l) => l.querySelectorAll('.lane-tile').length), header: document.querySelector('.lanes__count')?.innerText || '', counts: [...document.querySelectorAll('.lane__n')].map((e) => Number(e.innerText)) }));
    await ctx.close();
    return [
      ok('each lane shows 8 tiles or fewer', m.tiles.every((n) => n <= 8), m.tiles.join(',')),
      ok('lane counts add up to the API tool total', m.counts.reduce((a, b) => a + b, 0) === tools, `${m.counts.join('+')} vs ${tools}`),
      ok('header matches the API', m.header.includes(`${tools} tools across ${all.length} reviewed servers`), m.header.replace(/\s+/g, ' ')),
    ];
  }],
  // 8
  ['singular and plural labels', async (browser) => {
    const ctx = await browser.newContext({ viewport: VP.desktop });
    const page = await ctx.newPage();
    await page.route('**/api/v1/servers?*', async (route) => { const r = await route.fetch(); const j = await r.json(); if (j.data?.length) j.data[0].downloads_count = 1; await route.fulfill({ response: r, json: j }); });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.querySelector('.cf-card')?.innerText ?? '');
    await ctx.close();
    return [ok('a count of 1 reads "1 export", not "1 exports"', /\b1 export\b/i.test(text) && !/\b1 exports\b/i.test(text), (text.match(/.{0,20}\b1 exports?\b.{0,5}/i) || ['(not found)'])[0].replace(/\s+/g, ' '))];
  }],
];

if (process.argv.includes('--list')) { CASES.forEach(([n], i) => console.log(`${i + 1}. ${n}`)); process.exit(0); }

const exe = findChrome();
const browser = await chromium.launch({ executablePath: exe, headless: true });
let failed = 0;
for (const [i, [name, fn]] of CASES.entries()) {
  if (only && !only.includes(i + 1)) continue;
  let rows;
  try { rows = await fn(browser); } catch (e) { rows = [ok('case ran without throwing', false, String(e.message || e).slice(0, 160))]; }
  const bad = rows.filter((r) => !r.pass).length;
  failed += bad;
  console.log(`\n${bad ? 'RED  ' : 'GREEN'} ${i + 1}. ${name}`);
  for (const r of rows) console.log(`      ${r.pass ? 'ok  ' : 'FAIL'} ${r.label}${r.detail ? `  [${r.detail}]` : ''}`);
}
await browser.close();
console.log(`\n${failed ? `${failed} check(s) failed` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
