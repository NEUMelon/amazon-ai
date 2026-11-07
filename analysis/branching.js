'use strict';
// 自对弈棋谱的统计：每个局面的合法着法数、是否已分隔、争夺格数；每局的分隔手数与长度。输出 data/branching.json
//   node analysis/branching.js [data/raw/selfplay.jsonl]
const fs = require('fs'), path = require('path');
const G = require('../engine');
const src = process.argv[2] || path.join(__dirname, '../data/raw/selfplay.jsonl');
const games = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const rows = [], per = [];
for (const g of games) {
  const b = new G.Board();
  let sepAt = -1;
  for (let k = 0; k <= g.moves.length; k++) {
    if (b.isOver()) break;
    const n = b.countMoves();
    const sep = G.Eval.separated(b);
    if (sep && sepAt < 0) sepAt = k;
    rows.push([k, n, sep ? 1 : 0, G.contestedCount(b)]);
    if (k < g.moves.length) b.play(G.parseMove(g.moves[k]));
  }
  per.push({ id: g.id, length: g.length, sepAt, winner: g.winner });
}
const pre = rows.filter(r => !r[2]);
const mean = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const first10 = rows.filter(r => r[0] < 10).map(r => r[1]);
const L = per.map(p => p.length), S = per.filter(p => p.sepAt >= 0).map(p => p.sepAt);
// 博弈树复杂度：按 Allis 的做法，用每个局面合法着法数的几何平均取 b^L：log10 = Σ_k mean_k(log10 b) 沿平均对局长度累加
const byPly = {};
for (const r of rows) (byPly[r[0]] = byPly[r[0]] || []).push(r[1]);
const meanLen = mean(per, p => p.length);
let logGTC = 0; for (let k = 0; k < Math.round(meanLen); k++) if (byPly[k]) logGTC += mean(byPly[k], x => Math.log10(Math.max(1, x)));
const summary = {
  games: games.length, positions: rows.length,
  bfMean: mean(rows, r => r[1]), bfPreSep: mean(pre, r => r[1]), bfFirst10Median: med(first10), bfStart: rows[0][1],
  lenMean: meanLen, lenMin: Math.min(...L), lenMax: Math.max(...L),
  sepMean: mean(S.map(x => [x]), r => r[0]), sepMedian: med(S), sepMin: Math.min(...S), sepMax: Math.max(...S), sepShareOfGame: mean(per.filter(p => p.sepAt >= 0), p => (p.length - p.sepAt) / p.length),
  logGTC, logGTCnaive: meanLen * Math.log10(mean(rows, r => r[1])),
};
fs.writeFileSync(path.join(__dirname, '../data/branching.json'), JSON.stringify({ summary, rows, per }));
console.log(JSON.stringify(summary, null, 1));
