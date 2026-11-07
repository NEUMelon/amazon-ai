/*
 * movegen.js — 着法的廉价打分与筛选
 *
 * 亚马逊棋开局时约有 2176 个合法走法，中局也常有数百个，无法全宽搜索。
 * 这里给每个走法一个只需常数次查表的“廉价分数”，用于：α-β 的束宽筛选与排序、
 * MCTS 的渐进展开顺序与先验、贪心与模拟策略。分数由两部分组成：
 *   后的移动：0.5 ×（到达点的机动性 − 出发点的机动性），机动性截断到 12；
 *   箭的位置：2 ×（箭旁相邻的对方后数）− 1 ×（箭旁相邻的己方后数）
 *             + 1 ×（该格对方后距离 ≤ 己方后距离，即对方的领地或均势格）
 *             + 2^(1−d)（d 为对方后到该格的距离，越靠近对方的后越好）。
 * 第一项鼓励把后走到开阔处，第二项鼓励用箭封堵对方的后、争夺对方领地而不堵自己。
 * 这些规则是本文作者根据亚马逊棋的常见经验设定的（Lieberum 2005；Kloetzer 等 2007），
 * 线性策略（policy.js）用同一组特征从对局数据中学习权重。
 */
'use strict';
const C = require('./core.js');
const E = require('./eval.js');
const { NN, EMPTY, INF, RAYS, NEIGH } = C;

const ROW = new Int8Array(NN), COL = new Int8Array(NN);
for (let i = 0; i < NN; i++) { ROW[i] = (i / 10) | 0; COL[i] = i % 10; }
function adj(a, b) { const dr = ROW[a] - ROW[b], dc = COL[a] - COL[b]; return a !== b && dr <= 1 && dr >= -1 && dc <= 1 && dc >= -1; }

const dMe = new Uint8Array(NN), dOp = new Uint8Array(NN);
const oppAdj = new Int8Array(NN), ownAdj = new Int8Array(NN);
const POW2 = new Float64Array(INF + 1);
for (let i = 0; i <= INF; i++) POW2[i] = i === 0 ? 0 : Math.pow(2, 1 - i);   // 1, 0.5, 0.25 …（距离 1 记 1）
const W_DEFAULT = { mob: 0.5, oppAdj: 2, ownAdj: 1, terr: 1 };

// 所有候选走法及分数的缓冲区（容量足够开局局面）
const MAXM = 4096;
const bufM = new Int32Array(MAXM), bufS = new Float64Array(MAXM);

/** 预计算结点信息：双方后距离与相邻关系 */
function prepare(b) {
  const s = b.side, o = 3 - s, cells = b.cells;
  E.queenDist(cells, b.queens[s], dMe); E.queenDist(cells, b.queens[o], dOp);
  oppAdj.fill(0); ownAdj.fill(0);
  for (const q of b.queens[o]) for (const n of NEIGH[q]) oppAdj[n]++;
  for (const q of b.queens[s]) for (const n of NEIGH[q]) ownAdj[n]++;
}

/**
 * 生成全部走法与廉价分数；返回走法数 n，结果在 bufM/bufS 中。
 * w 为权重对象（默认 W_DEFAULT）。
 */
function scoreAll(b, w = W_DEFAULT) {
  prepare(b);
  const s = b.side, cells = b.cells;
  let n = 0;
  for (const f of b.queens[s]) {
    const mobF = Math.min(12, E.queenMobility(cells, f));
    cells[f] = EMPTY;
    const rf = RAYS[f];
    for (let d = 0; d < 8; d++) {
      const ray = rf[d];
      for (let k = 0; k < ray.length; k++) {
        const t = ray[k]; if (cells[t] !== EMPTY) break;
        const mobT = Math.min(12, E.queenMobility(cells, t));
        const qs = w.mob * (mobT - mobF);
        const base = f * 10000 + t * 100, rt = RAYS[t];
        for (let e = 0; e < 8; e++) {
          const r2 = rt[e];
          for (let j = 0; j < r2.length; j++) {
            const a = r2[j]; if (cells[a] !== EMPTY) break;
            const own = ownAdj[a] - (adj(a, f) ? 1 : 0) + (adj(a, t) ? 1 : 0);
            const terr = (dOp[a] <= dMe[a] && dOp[a] < INF ? 1 : 0) + POW2[dOp[a]];
            bufM[n] = base + a; bufS[n] = qs + w.oppAdj * oppAdj[a] - w.ownAdj * own + w.terr * terr; n++;
          }
        }
      }
    }
    cells[f] = s;
  }
  return n;
}

/** 廉价分数最高的 k 个走法（k<=0 表示全部），按分数降序（同分按编码升序，保证确定性）；返回 {moves, scores, total} */
function topMoves(b, k, w) { return selectTop(scoreAll(b, w), k); }

/*
 * 可分离评估排序（本文采用的近似，第 2.5 节）：
 *   score(f→t, a) ≈ Q(f,t) + A(a)，
 *   Q(f,t)：只移动后、不射箭时的静态评估（行棋方视角）；
 *   A(a)  ：不移动后、只在 a 处放一支箭时评估值的变化量。
 * 只需约（后的走法数 + 空格数）次静态评估（中局约 150 次，≈1 ms），就能给全部走法打分，
 * 比逐个评估全部走法（数百至两千次）便宜一个数量级；在随机中局局面中，
 * 真正的静态最佳走法有约 90% 落在近似排序的前 8 名（第 5.9 节）。
 */
const Qtab = new Float64Array(NN * NN), Atab = new Float64Array(NN);
function sepScoreAll(b, weights) {
  const s = b.side, o = 3 - s, cells = b.cells, qs = b.queens[s];
  // A：只放箭（视角仍为行棋方，评估时轮到对方走，故取负）
  b.side = o;
  const e0 = -E.evaluate(b, weights);
  for (let a = 0; a < NN; a++) {
    if (cells[a] !== EMPTY) { Atab[a] = 0; continue; }
    cells[a] = C.ARROW; Atab[a] = -E.evaluate(b, weights) - e0; cells[a] = EMPTY;
  }
  b.side = s;
  let n = 0;
  for (let qi = 0; qi < 4; qi++) {
    const f = qs[qi];
    cells[f] = EMPTY;
    const rf = RAYS[f];
    for (let d = 0; d < 8; d++) {
      const ray = rf[d];
      for (let k = 0; k < ray.length; k++) {
        const t = ray[k]; if (cells[t] !== EMPTY) break;
        cells[t] = s; qs[qi] = t; b.side = o;
        const q = -E.evaluate(b, weights);
        b.side = s; qs[qi] = f; cells[t] = EMPTY;
        const base = f * 10000 + t * 100, rt = RAYS[t];
        for (let e = 0; e < 8; e++) {
          const r2 = rt[e];
          for (let j = 0; j < r2.length; j++) {
            const a = r2[j]; if (cells[a] !== EMPTY) break;
            bufM[n] = base + a; bufS[n] = q + (a === f ? 0 : Atab[a]); n++;
          }
        }
      }
    }
    cells[f] = s;
  }
  return n;
}

function selectTop(n, k) {
  if (k <= 0 || k >= n / 4) {
    const arr = new Array(n); for (let i = 0; i < n; i++) arr[i] = i;
    arr.sort((x, y) => bufS[y] - bufS[x] || bufM[x] - bufM[y]);
    const m = k > 0 ? Math.min(k, n) : n;
    const moves = new Array(m), scores = new Array(m);
    for (let i = 0; i < m; i++) { moves[i] = bufM[arr[i]]; scores[i] = bufS[arr[i]]; }
    return { moves, scores, total: n };
  }
  const tm = new Int32Array(k), ts = new Float64Array(k); let c = 0;
  for (let i = 0; i < n; i++) {
    const v = bufS[i], mv = bufM[i];
    if (c === k && (v < ts[k - 1] || (v === ts[k - 1] && mv > tm[k - 1]))) continue;
    let j = c < k ? c++ : k - 1;
    while (j > 0 && (ts[j - 1] < v || (ts[j - 1] === v && tm[j - 1] > mv))) { ts[j] = ts[j - 1]; tm[j] = tm[j - 1]; j--; }
    ts[j] = v; tm[j] = mv;
  }
  return { moves: Array.from(tm.subarray(0, c)), scores: Array.from(ts.subarray(0, c)), total: n };
}
/** 可分离评估排序的前 k 名 */
function sepTopMoves(b, k, weights) { return selectTop(sepScoreAll(b, weights), k); }

/** 学习策略使用的走法特征（与廉价分数同源，另加若干距离特征）。在 prepare(b) 之后调用 */
const POLICY_FEATURES = ['mobDelta', 'mobT', 'oppAdj', 'ownAdj', 'terr', 'dOpT1', 'dOpT2', 'arrowNearOpp', 'arrowDist', 'qDist', 'opMobLoss'];
function moveFeatures(b, m, out = new Float64Array(POLICY_FEATURES.length)) {
  const s = b.side, cells = b.cells, f = C.mFrom(m), t = C.mTo(m), a = C.mArrow(m);
  const mobF = Math.min(12, E.queenMobility(cells, f));
  cells[f] = EMPTY; cells[t] = s;
  const mobT0 = Math.min(12, E.queenMobility(cells, t));
  // 箭对对方后机动性的削减量
  let loss = 0;
  for (const q of b.queens[3 - s]) {
    const before = E.queenMobility(cells, q);
    cells[a] = C.ARROW; const after = E.queenMobility(cells, q); cells[a] = EMPTY;
    loss += before - after;
  }
  cells[t] = EMPTY; cells[f] = s;
  const own = ownAdj[a] - (adj(a, f) ? 1 : 0) + (adj(a, t) ? 1 : 0);
  const cheb = (x, y) => Math.max(Math.abs(ROW[x] - ROW[y]), Math.abs(COL[x] - COL[y]));
  out[0] = (mobT0 - mobF) / 4;
  out[1] = mobT0 / 12;
  out[2] = oppAdj[a];
  out[3] = own;
  out[4] = dOp[a] <= dMe[a] && dOp[a] < INF ? 1 : 0;
  out[5] = dOp[t] === 1 ? 1 : 0;
  out[6] = dOp[t] === 2 ? 1 : 0;
  out[7] = dOp[a] === 1 ? 1 : 0;
  out[8] = cheb(a, t) / 9;
  out[9] = cheb(f, t) / 9;
  out[10] = loss / 8;
  return out;
}

module.exports = { prepare, scoreAll, topMoves, sepScoreAll, sepTopMoves, selectTop, moveFeatures, POLICY_FEATURES, W_DEFAULT, bufM, bufS, adj };
