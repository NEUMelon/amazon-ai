'use strict';
// 测试局面集：从自对弈数据的测试集对局（后 20%）中随机抽取 60 个尚未分隔的局面（固定随机种子）。
//   node experiments/make_positions.js data/raw/selfplay.jsonl data/positions.json
// 效率测试、决策质量测试与随机性测试共用这一局面集；训练学习模型时这些对局不参与训练。
const fs = require('fs');
const G = require('../engine');
const [src, out] = process.argv.slice(2);
const games = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const rng = G.mulberry32(4242);
const test = games.slice(Math.floor(games.length * 0.8));
const pos = [], seen = new Set();
while (pos.length < 60) {
  const gi = (rng() * test.length) | 0, g = test[gi];
  const k = 4 + ((rng() * 56) | 0);
  if (k >= g.moves.length || seen.has(gi + ':' + k)) continue;
  const b = G.Board.fromMoves(g.moves.slice(0, k));
  if (G.Eval.separated(b) || b.isOver()) continue;
  seen.add(gi + ':' + k);
  pos.push({ id: pos.length, game: g.id, ply: k, nMoves: b.genMoves().length, moves: g.moves.slice(0, k) });
}
pos.sort((a, b) => a.ply - b.ply).forEach((p, i) => p.id = i);
fs.writeFileSync(out, JSON.stringify({ seed: 4242, note: '自对弈测试集对局中随机抽取的未分隔局面', positions: pos }, null, 1));
console.log('positions', pos.length, 'ply range', pos[0].ply, pos[pos.length - 1].ply);
