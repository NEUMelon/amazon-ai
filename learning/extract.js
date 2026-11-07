'use strict';
/*
 * 从自对弈棋谱中提取学习数据：
 *   node learning/extract.js data/raw/selfplay.jsonl data/learn
 * 1) 走子策略数据：每个“常规搜索”局面，取可分离评估前 40 名作为候选集合，记录 12 维特征与实际走法的位置；
 *    实际走法不在候选集合内的局面计入“覆盖率”统计后跳过。
 * 2) Texel 数据：每个双方尚未分隔的局面，记录 10 维评估特征（白方视角）、行棋方与对局结果。
 */
const fs = require('fs'), path = require('path');
const G = require('../engine');
const P = G.Policy, E = G.Eval;
const [src, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const games = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const PRE = 40;
const polX = [], polRows = [], tex = [];
let covered = 0, total = 0;
games.forEach((g, gi) => {
  const b = new G.Board();
  const nOpen = g.opening.length;
  g.moves.forEach((s, k) => {
    const m = G.parseMove(s);
    const lg = k >= nOpen ? g.log[k - nOpen] : null;
    if (!E.separated(b) && !b.isOver()) {
      const t = E.texelFeatures(b);
      tex.push({ g: gi, k, side: b.side, x: t.x.map(v => +v.toFixed(5)), y: g.winner === G.WHITE ? 1 : 0 });
      if (lg && lg.r === 'search') {
        total++;
        const c = P.candidateFeatures(b, PRE);
        const idx = c.moves.indexOf(m);
        if (idx >= 0) {
          covered++;
          for (const f of c.feats) polX.push(...f);
          polRows.push([gi, k, c.moves.length, idx]);
        }
      }
    }
    b.play(m);
  });
  if ((gi + 1) % 50 === 0) console.log(gi + 1, '/', games.length, 'policy samples', polRows.length);
});
fs.writeFileSync(path.join(outDir, 'policy_X.f32'), Buffer.from(new Float32Array(polX).buffer));
fs.writeFileSync(path.join(outDir, 'policy_meta.json'), JSON.stringify({ dim: P.NF, names: P.FEATURE_NAMES, pre: PRE, coverage: covered / total, covered, total, rows: polRows }));
fs.writeFileSync(path.join(outDir, 'texel.json'), JSON.stringify({ names: E.FEATURES, n: tex.length, games: games.length, rows: tex }));
console.log(`games ${games.length}; policy samples ${polRows.length} (coverage ${(covered / total * 100).toFixed(1)}% in top-${PRE}); texel positions ${tex.length}`);
