'use strict';
/*
 * 搜索效率测试（单进程，避免并行干扰计时）：
 *   node experiments/efficiency.js data/positions.json data/efficiency.json
 * 测试局面：data/positions.json（见 make_positions.js）。
 *  E1 着法排序质量：静态评估最佳走法在廉价排序 / 可分离评估排序中的名次，以及各排序方法的耗时；
 *  E2 固定深度 3 的 α-β：各增强组合的结点数、用时、首着截断率与置换表命中；
 *  E3 200 ms 预算下：α-β 达到的深度与 MCTS 各变体的模拟次数（按对局阶段分组）。
 */
const fs = require('fs');
const G = require('../engine');
const E = G.Eval, M = G.MoveGen;
const [src, out] = process.argv.slice(2);
const pos = JSON.parse(fs.readFileSync(src)).positions;
const hr = () => Number(process.hrtime.bigint()) / 1e6;
const res = { positions: pos.map(p => ({ ply: p.ply, nMoves: G.Board.fromMoves(p.moves).genMoves().length })), E1: [], E2: {}, E3: {} };

// E1
for (const p of pos) {
  const b = G.Board.fromMoves(p.moves);
  const ms = b.genMoves();
  let t = hr();
  const sc = ms.map(m => { b.play(m); const v = -E.evaluate(b); b.undo(); return v; });
  const tFull = hr() - t;
  const best = Math.max(...sc);
  const goods = new Set(ms.filter((m, i) => sc[i] >= best - 1e-9));
  t = hr(); const ch = M.topMoves(b, 0).moves; const tCheap = hr() - t;
  t = hr(); const sp = M.sepTopMoves(b, 0).moves; const tSep = hr() - t;
  const rank = list => list.findIndex(m => goods.has(m));
  res.E1.push({ ply: p.ply, n: ms.length, rankCheap: rank(ch), rankSep: rank(sp), tFull, tCheap, tSep });
}
console.log('E1 done');

// E2：固定深度 3
const variants = {
  full: {}, noTT: { useTT: false }, noKiller: { useKillers: false, useHistory: false }, noPVS: { usePVS: false },
  plain: { useTT: false, useKillers: false, useHistory: false, usePVS: false }, cheapOrder: { order: 'cheap' }, sepLeaf: { leafOrder: 'sep' },
};
for (const [name, o] of Object.entries(variants)) {
  const rows = [];
  for (const p of pos) {
    const b = G.Board.fromMoves(p.moves);
    const ab = new G.Search.AlphaBeta(Object.assign({ timeMs: 1e9, maxDepth: 3 }, o));
    const t = hr(); const r = ab.search(b); const ms = hr() - t;
    rows.push({ ply: p.ply, nodes: r.nodes, ms, score: r.score, move: G.moveToStr(r.move), cut: r.stats.cutoffs, first: r.stats.firstCutoffs, tt: r.stats.ttHits, interior: r.stats.interior });
  }
  res.E2[name] = rows;
  console.log('E2', name, rows.reduce((s, r) => s + r.ms, 0).toFixed(0), 'ms');
}

// E3：200 ms 预算
const agents = ['ab', 'ab-cheapOrder', 'mcts-pure', 'mcts-uct', 'mcts-cutoff', 'mcts-sep', 'mcts-puct'];
if (fs.existsSync(__dirname + '/../models/policy_weights.json')) { G.setPolicyTheta(JSON.parse(fs.readFileSync(__dirname + '/../models/policy_weights.json')).theta); agents.push('mcts-learned'); }
for (const a of agents) {
  const rows = [];
  for (const p of pos) {
    const b = G.Board.fromMoves(p.moves);
    const ag = G.makeAgent(a, { timeMs: 200, seed: 7 });
    const t = hr(); const r = ag.think(b); const ms = hr() - t;
    rows.push({ ply: p.ply, ms, depth: r.depth, nodes: r.nodes, sims: r.simulations, selDepth: r.selDepth, avgDepth: r.avgDepth, children: r.rootChildren, reason: r.reason });
  }
  res.E3[a] = rows;
  console.log('E3', a);
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
