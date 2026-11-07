'use strict';
// 生成均衡开局：白、黑各走一步（共 2 手，轮白方走）。
// 每一手从“静态评估排序前 30 名”中随机选取，再用 1 秒的 α-β 评估过滤掉明显失衡的开局（|评估| ≥ 4 格）。
const G = require('../engine');
const fs = require('fs');
const rng = G.mulberry32(20261107);
const out = [], seen = new Set();
let tried = 0;
function topStatic(b, k) {
  const ms = G.MoveGen.topMoves(b, 240).moves;
  const sc = ms.map(m => { b.play(m); const v = -G.evaluate(b); b.undo(); return v; });
  return ms.map((m, i) => [m, sc[i]]).sort((x, y) => y[1] - x[1]).slice(0, k).map(x => x[0]);
}
const first = topStatic(new G.Board(), 30);
while (out.length < 32) {
  tried++;
  const b = new G.Board();
  b.play(first[(rng() * first.length) | 0]);
  const rep = topStatic(b, 30);
  b.play(rep[(rng() * rep.length) | 0]);
  const key = b.history.join(',');
  if (seen.has(key)) continue; seen.add(key);
  const r = new G.Search.AlphaBeta({ timeMs: 1000 }).search(b);
  if (Math.abs(r.score) >= 4) continue;
  out.push({ moves: b.history.map(G.moveToStr), eval: +r.score.toFixed(2), depth: r.depth });
  console.log(out.length, out[out.length - 1]);
}
fs.writeFileSync(__dirname + '/../data/openings.json', JSON.stringify({ seed: 20261107, tried, note: '白、黑各一手，均取自静态评估前 30 名；轮白方走；1 s α-β |eval|<4', openings: out }, null, 1));
console.log('tried', tried, 'kept', out.length);
