'use strict';
// 失败案例的复盘数据：node analysis/failure.js  → data/failure.json
//  案例一：第一版“分隔判定”漏洞（data_v1 中的第一轮主实验）——统计“分隔后又恢复接触”的频率并抽取一局复盘；
//  案例二：分隔后的近似——“分隔时区域格数领先的一方”最终却输掉的对局（修复后的主实验）；
//  案例三：强智能体输给弱智能体的对局（修复后的主实验），找出强方评估下降最大的一步并用更长时间重新搜索。
const fs = require('fs'), path = require('path');
const G = require('../engine');
const E = G.Eval;
const R = path.join(__dirname, '..');
const load = p => fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const out = {};
// 第一版的分隔判定（只看争夺格），用于复盘第一轮数据
const oldSep = b => G.contestedCount(b) === 0;
const regions = b => { const t = E.texelFeatures(b); return [t.regionW, t.regionB]; };

// ---------------- 案例一
{
  const games = load(path.join(R, 'data_v1/raw/main.jsonl'));
  let n = 0, sepGames = 0, revertGames = 0, falsePos = 0, sepPos = 0, flipped = 0, flippedRevert = 0;
  for (const g of games) {
    const ag = [g.white.agent, g.black.agent];
    if (ag.includes('random') || ag.includes('mcts-pure')) continue;
    n++;
    const b = G.Board.fromMoves(g.opening);
    let first = -1, pred = 0, rev = false;
    for (let i = g.opening.length; i <= g.moves.length && !b.isOver(); i++) {
      const s = oldSep(b);
      if (s) { sepPos++; if (!E.separated(b)) falsePos++; }
      if (s && first < 0) { first = i; const [w, k] = regions(b); pred = (w - k - (b.side === 1 ? 0.5 : -0.5)) > 0 ? 1 : 2; }
      if (!s && first >= 0) rev = true;
      if (i < g.moves.length) b.play(G.parseMove(g.moves[i]));
    }
    if (first >= 0) { sepGames++; if (rev) revertGames++; if (pred !== g.winner) { flipped++; if (rev) flippedRevert++; } }
  }
  const g = games.find(x => x.id === 'T:ab~mcts-pure|14|BA');
  // 找到黑方（α-β）第一次使用填格策略、随后又恢复搜索的手数
  let fill = -1, back = -1;
  g.log.forEach((e, i) => { if (e.s === 2 && e.r === 'filler' && fill < 0) fill = i; if (fill >= 0 && back < 0 && i > fill && e.s === 2 && e.r === 'search') back = i; });
  const ply = g.opening.length + fill;
  const b = G.Board.fromMoves(g.moves.slice(0, ply));
  out.case1 = { n, sepGames, revertGames, sepPos, falsePos, flipped, flippedRevert, id: g.id, winner: g.winner, moves: g.moves, fillPly: ply + 1, backPly: g.opening.length + back + 1,
    scores: g.log.filter(e => e.s === 2).map((e, i) => ({ ply: g.opening.length + 2 * i + 2, r: e.r, sc: e.sc })), oldSep: oldSep(b), newSep: E.separated(b),
    terr: G.territoryMap(b) };
}

// ---------------- 案例二：修复后，分隔时刻的区域计数对胜负的预测
{
  const games = load(path.join(R, 'data/raw/main.jsonl'));
  let n = 0, wrong = 0, diffs = [], ex = [];
  for (const g of games) {
    const ag = [g.white.agent, g.black.agent];
    if (ag.includes('random') || ag.includes('mcts-pure')) continue;
    const b = G.Board.fromMoves(g.opening);
    for (let i = g.opening.length; i < g.moves.length && !b.isOver(); i++) {
      if (E.separated(b)) {
        const [w, k] = regions(b); const d = w - k - (b.side === 1 ? 0.5 : -0.5); const pred = d > 0 ? 1 : 2; n++;
        if (pred !== g.winner) { wrong++; diffs.push(Math.abs(d)); ex.push({ id: g.id, ply: i, regionW: w, regionB: k, side: b.side, winner: g.winner, length: g.length }); }
        break;
      }
      b.play(G.parseMove(g.moves[i]));
    }
  }
  ex.sort((x, y) => Math.abs(y.regionW - y.regionB) - Math.abs(x.regionW - x.regionB));
  const e0 = ex[0];
  let detail = null;
  if (e0) {
    const g = games.find(x => x.id === e0.id);
    const b = G.Board.fromMoves(g.moves.slice(0, e0.ply));
    detail = { moves: g.moves, ply: e0.ply, terr: G.territoryMap(b), filled: { W: 0, B: 0 } };
    // 统计分隔后双方实际走了多少步
    for (let i = e0.ply; i < g.moves.length; i++) { const s = i % 2 === 0 ? 'W' : 'B'; detail.filled[s]++; }
  }
  out.case2 = { n, wrong, rate: n ? wrong / n : 0, maxDiff: diffs.length ? Math.max(...diffs) : 0, examples: ex.slice(0, 10), detail };
}

// ---------------- 案例三：强智能体输给弱智能体
{
  const games = load(path.join(R, 'data/raw/main.jsonl'));
  const STRONG = ['ab', 'ab-tuned', 'mcts-puct', 'mcts-learned'], WEAK = ['greedy', 'mcts-pure', 'mcts-cutoff'];
  const ups = [];
  for (const g of games) {
    if (!g.tag.startsWith('T:')) continue;
    const w = g.winner === 1 ? g.white.agent : g.black.agent, l = g.winner === 1 ? g.black.agent : g.white.agent;
    if (WEAK.includes(w) && STRONG.includes(l)) ups.push({ id: g.id, winner: w, loser: l, length: g.length });
  }
  out.upsets = ups;
  // 取第一局“α-β 输”的对局做复盘
  const u = ups.find(x => x.loser === 'ab') || ups[0];
  if (u) {
    const g = games.find(x => x.id === u.id);
    const side = g.white.agent === u.loser ? 1 : 2;
    const mine = g.log.map((e, i) => ({ i, ...e })).filter(e => e.s === side && (e.r === 'search' || e.r === 'mcts'));
    const val = e => e.sc != null ? e.sc : (e.wr - 0.5) * 40;
    let worst = null;
    for (let k = 1; k < mine.length; k++) { if (Math.abs(val(mine[k])) >= 100 || Math.abs(val(mine[k - 1])) >= 100) continue; const d = val(mine[k]) - val(mine[k - 1]); if (!worst || d < worst.d) worst = { d, k }; }   // 只看分隔之前
    const prev = mine[worst.k - 1];
    const ply = g.opening.length + prev.i;
    const b = G.Board.fromMoves(g.moves.slice(0, ply));
    const deep = new G.Search.AlphaBeta({ timeMs: 5000 }).search(b);
    const deepPlayed = (() => { const c = b.clone(); c.play(G.parseMove(g.moves[ply])); const r = new G.Search.AlphaBeta({ timeMs: 5000 }).search(c); return -r.score; })();
    out.case3 = { ...u, side, moves: g.moves, ply: ply + 1, played: g.moves[ply], scoreBefore: val(prev), scoreAfter: val(mine[worst.k]), drop: worst.d,
      deep: { move: G.moveToStr(deep.move), score: deep.score, depth: deep.depth, pv: deep.pv }, deepPlayedValue: deepPlayed,
      trace: mine.map(e => ({ ply: g.opening.length + e.i + 1, v: +val(e).toFixed(2), r: e.r })) };
  }
}
fs.writeFileSync(path.join(R, 'data/failure.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ c1: { ...out.case1, moves: undefined, scores: undefined, terr: undefined }, c2: { ...out.case2, detail: undefined }, ups: out.upsets.length, c3: out.case3 && { ...out.case3, moves: undefined, trace: undefined } }, null, 1));
