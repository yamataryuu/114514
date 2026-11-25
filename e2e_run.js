/* 两局对照：node tests/e2e_run.js
   需本机 HTTP 站点（python3 -m http.server 8080）与 playwright。
   输出两局的时长、得分（kills）、结算与重开后表现，供第 4 问对照记录使用。 */
'use strict';
const BASE = process.env.BASE || 'http://127.0.0.1:8128/?god=1&fast=1';
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { chromium = require('/usr/local/lib/node_modules/playwright').chromium; }

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__game && window.RecordStore);

  async function oneRun(name) {
    await p.evaluate(n => { document.getElementById('nick').value = n; window.__game.start(); }, name);
    const mid = await p.evaluate(() => {
      const g = window.__game;
      let bossSeen = false, maxBullets = 0, maxEbullets = 0, shots = 0;
      for (let w = 1; w <= 10; w++) {
        g.setWave(w);
        for (let i = 0; i < 300; i++) {
          g.tick(0.033);
          if (g.snapshot().state === 'levelup') g.pickUpgrade(0);   // 真实选卡，不跳过升级
          const s = g.snapshot();
          if (s.boss) bossSeen = true;
          maxBullets = Math.max(maxBullets, s.bullets);
          maxEbullets = Math.max(maxEbullets, s.ebullets);
          if (s.bullets > 0) shots++;
        }
        g.killAll(); g.tick(0.033);
      }
      return { state: g.snapshot().state, bossSeen, maxBullets, maxEbullets, shots };
    });
    const rec = await p.evaluate(() => {
      const g = window.__game, rows = g.records();
      return { total: rows.length, last: rows[rows.length - 1], save: g.lastSave() };
    });
    return { name, mid, rec };
  }

  const r1 = await oneRun('测试员A');
  const r2 = await oneRun('测试员B');     // 重开一局：start() 内部 reset
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__game);
  const afterReload = await p.evaluate(() => window.__game.records().length);

  const brief = r => ({
    name: r.rec.last.playerName, result: r.rec.last.result,
    waveReached: r.rec.last.waveReached,
    durationSec: r.rec.last.durationSec, kills: r.rec.last.kills,
    level: r.rec.last.level, hpLeft: r.rec.last.hpLeft,
    upgrades: r.rec.last.upgrades.length,
    bossSeen: r.mid.bossSeen, maxBullets: r.mid.maxBullets,
    maxEbullets: r.mid.maxEbullets, autoFireFrames: r.mid.shots
  });
  const out = {
    run1: brief(r1), run2: brief(r2),
    recordsAfterReload: afterReload,
    sameResult: brief(r1).result === brief(r2).result,
    pageerrors: errs
  };
  console.log(JSON.stringify(out, null, 2));
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'data', 'e2e-compare.json'),
    JSON.stringify(out, null, 2) + '\n');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
