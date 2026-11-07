'use strict';
// 对局器：给定开局与双方智能体，完整下完一局并记录每步诊断信息（亚马逊棋白方先走）
const G = require('../engine');
function playGame(whiteAgent, blackAgent, opening = [], opts = {}) {
  const b = G.Board.fromMoves(opening);
  const log = [];
  const maxMoves = opts.maxMoves || 100;            // 10×10 棋盘最多 92 手，必然在此之前结束
  while (!b.isOver() && b.history.length < maxMoves) {
    const ag = b.side === G.WHITE ? whiteAgent : blackAgent;
    const t0 = process.hrtime.bigint();
    const r = ag.think(b);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (!b.isLegal(r.move)) throw new Error('agent returned illegal move ' + r.move);
    log.push({ side: b.side, move: r.move, ms, reason: r.reason, score: r.score, depth: r.depth, nodes: r.nodes, sims: r.simulations, winrate: r.winrate, selDepth: r.selDepth });
    b.play(r.move);
  }
  return { winner: b.winner, moves: b.history.slice(), opening: opening.slice(), log, length: b.history.length };
}
module.exports = { playGame };
if (require.main === module) {
  const [a, bb, t] = process.argv.slice(2);
  const A = G.makeAgent(a, { timeMs: +t || 200 }), B = G.makeAgent(bb, { timeMs: +t || 200, seed: 2 });
  const t0 = Date.now();
  const g = playGame(A, B, []);
  const bd = G.Board.fromMoves(g.moves); console.log(bd.toString());
  console.log('winner', g.winner === 1 ? 'white ' + a : 'black ' + bb, 'len', g.length, 'sec', (Date.now() - t0) / 1000);
  console.log(g.log.map(x => `${G.moveToStr(x.move)}:${x.reason[0]}:${x.depth ?? x.sims}:${x.score != null ? (+x.score).toFixed(1) : (+x.winrate).toFixed(2)}`).join(' '));
}
