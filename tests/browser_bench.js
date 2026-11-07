'use strict';
// 浏览器与 Node 的引擎速度对比：node tests/browser_bench.js
// 在 Chromium 页面主线程中，对 data/positions.json 的前 20 个局面运行与 Node 相同的固定深度 α-β 与固定时长 MCTS，输出 data/browser_bench.json
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const G = require('../engine');
const URL = 'file://' + path.join(__dirname, '../game/dist/amazons.html');
const pos = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/positions.json'))).positions.slice(0, 20).map(p => p.moves);
function bench(G, pos) {
  let n = 0, t = 0, sims = 0, st = 0;
  for (const mv of pos) {
    const b = G.Board.fromMoves(mv.map(G.parseMove));
    const t0 = performance.now();
    const r = new G.Search.AlphaBeta({ maxDepth: 3, timeMs: 1e9 }).search(b);
    t += performance.now() - t0; n += r.nodes;
  }
  for (const mv of pos.slice(0, 10)) {
    const b = G.Board.fromMoves(mv.map(G.parseMove));
    const r = new G.MCTSMod.MCTS({ selection: 'puct', order: 'sep', maxCand: 30, timeMs: 1000, seed: 3 }).search(b);
    sims += r.simulations; st += r.timeMs;
  }
  return { abNodes: n, abMs: t, nps: n / t * 1000, sims, simMs: st, simsPerSec: sims / st * 1000 };
}
(async () => {
  const node = bench(G, pos);
  console.log('node', JSON.stringify(node));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL); await page.waitForTimeout(500);
  const br = await page.evaluate(([src, pos]) => { const bench = eval('(' + src + ')'); return bench(window.AmazonsAI, pos); }, [bench.toString(), pos]);
  const ver = browser.version();
  console.log('chromium', JSON.stringify(br), ver);
  const out = { node, chromium: br, chromiumVersion: ver, nodeVersion: process.version, positions: pos.length };
  await browser.close();
  fs.writeFileSync(path.join(__dirname, '../data/browser_bench.json'), JSON.stringify(out, null, 1));
})();
