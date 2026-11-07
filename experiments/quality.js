'use strict';
/*
 * 决策质量测试：在 60 个测试局面上比较各智能体（200 ms）所选走法与“参考搜索”所选走法的价值差。
 *   node experiments/quality.js ref  data/positions.json data/quality_ref.json          # 参考：α-β 3 s
 *   node experiments/quality.js eval data/positions.json data/quality_ref.json out.json agent1,agent2,...
 * 走法价值 v(m)：走 m 之后，用 1.5 s 的 α-β 搜索对方局面，取负值（行棋方视角，单位：格）。
 * 遗憾值 regret = v(参考走法) − v(m)；同时报告与参考走法完全相同的比例。
 * 注意：参考搜索本身也只是更深的 α-β，并非真正的最优解；它与 α-β 智能体同源，比较对 α-β 偏有利（第 5.8 节讨论）。
 */
const fs = require('fs');
const G = require('../engine');
const [mode, posFile, refFile, outFile, agentList] = process.argv.slice(2);
const pos = JSON.parse(fs.readFileSync(posFile)).positions;
const pw = __dirname + '/../models/policy_weights.json';
if (fs.existsSync(pw)) G.setPolicyTheta(JSON.parse(fs.readFileSync(pw)).theta);
const tw = __dirname + '/../models/eval_weights_tuned.json';
if (fs.existsSync(tw)) G.setTunedWeights(JSON.parse(fs.readFileSync(tw)).weights);
function value(b, m) {
  b.play(m);
  let v;
  if (!b.canMove(b.side)) v = G.Search.WIN;
  else v = -new G.Search.AlphaBeta({ timeMs: 1500 }).search(b).score;
  b.undo();
  return v;
}
if (mode === 'ref') {
  const out = [];
  for (const p of pos) {
    const b = G.Board.fromMoves(p.moves);
    const r = new G.Search.AlphaBeta({ timeMs: 3000 }).search(b);
    out.push({ id: p.id, move: G.moveToStr(r.move), score: r.score, depth: r.depth, v: value(b, r.move) });
    console.log(p.id, out[out.length - 1]);
  }
  fs.writeFileSync(refFile, JSON.stringify(out, null, 1));
} else {
  const ref = JSON.parse(fs.readFileSync(refFile));
  const res = {};
  for (const a of agentList.split(',')) {
    const rows = [];
    for (const p of pos) {
      const b = G.Board.fromMoves(p.moves);
      const r = G.makeAgent(a, { timeMs: 200, seed: 11 + p.id }).think(b);
      const s = G.moveToStr(r.move), rf = ref[p.id];
      const v = s === rf.move ? rf.v : value(b, r.move);
      rows.push({ id: p.id, ply: p.ply, move: s, same: s === rf.move, v, regret: rf.v - v });
    }
    res[a] = rows;
    const mr = rows.reduce((x, r) => x + r.regret, 0) / rows.length;
    console.log(a, 'mean regret', mr.toFixed(2), 'same', rows.filter(r => r.same).length);
  }
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
}
