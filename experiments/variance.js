'use strict';
/*
 * 决策随机性测试：同一局面、同一智能体、不同随机种子重复决策 5 次，统计所选走法的一致程度。
 *   node experiments/variance.js data/positions.json data/variance.json agent1,agent2,...
 * α-β 本身是确定性的，但迭代加深受计时影响，在时间边界附近可能多搜或少搜一层，因此也会有差异。
 */
const fs = require('fs');
const G = require('../engine');
const [posFile, outFile, agentList] = process.argv.slice(2);
const pos = JSON.parse(fs.readFileSync(posFile)).positions.filter((_, i) => i % 2 === 0);   // 30 个局面
const pw = __dirname + '/../models/policy_weights.json';
if (fs.existsSync(pw)) G.setPolicyTheta(JSON.parse(fs.readFileSync(pw)).theta);
const res = {};
for (const a of agentList.split(',')) {
  const rows = [];
  for (const p of pos) {
    const b = G.Board.fromMoves(p.moves);
    const ms = [];
    for (let k = 0; k < 5; k++) ms.push(G.moveToStr(G.makeAgent(a, { timeMs: 200, seed: 1000 + 37 * k }).think(b).move));
    const cnt = {}; ms.forEach(m => cnt[m] = (cnt[m] || 0) + 1);
    rows.push({ id: p.id, ply: p.ply, moves: ms, distinct: Object.keys(cnt).length, modeShare: Math.max(...Object.values(cnt)) / 5 });
  }
  res[a] = rows;
  console.log(a, 'all-same', rows.filter(r => r.distinct === 1).length, '/', rows.length, 'mean distinct', (rows.reduce((s, r) => s + r.distinct, 0) / rows.length).toFixed(2));
}
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
