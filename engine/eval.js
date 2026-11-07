/*
 * eval.js — 亚马逊棋静态评估
 *
 * 采用 Lieberum（2005）提出、后被多数亚马逊棋程序沿用的“领地 + 位置 + 机动性”评估框架：
 *   t1：按后距离（queen distance）划分领地，谁先到达某格谁得 1 分，同时到达给行棋方 κ 分；
 *   t2：同样的划分，改用王距离（king distance）；
 *   c1：Σ 2·(2^-dW − 2^-dB)，后距离意义下的“位置”项；
 *   c2：Σ clip((kB − kW)/6, −1, 1)，王距离意义下的“位置”项；
 *   mob：双方各后的机动性（一步可到达的格数，截断到 12）之差；
 *   w ：Σ 2^-|dW − dB|（双方都能到达的格子），衡量局面“还剩多少争夺”，用来确定阶段。
 * 评估值 = Σ_k [ p·aE_k + (1−p)·aL_k ] · f_k，其中 p = min(1, w / W0) 是阶段系数。
 * 这样的写法对权重是线性的，可以直接用 Texel 方法拟合（learning/texel.py）。
 *
 * 双方被完全分隔后（没有任何空格同时可被双方到达），改用“区域格数”精确地比较剩余步数的上界。
 * 分数以“格”为单位，正值对行棋方有利。
 */
'use strict';
const C = require('./core.js');
const { NN, EMPTY, WHITE, BLACK, ARROW, INF, RAYS, NEIGH } = C;

const FEATURES = ['t1', 't2', 'c1', 'c2', 'mob'];
const NF = FEATURES.length;
// 手工设定的默认权重：前 5 个是开局（p=1）权重，后 5 个是终局（p=0）权重
const DEFAULT_WEIGHTS = [0.20, 0.20, 0.30, 0.30, 0.25, 1.00, 0.20, 0.05, 0.05, 0.05];
const W0 = 60;            // 阶段归一化常数（开局时 w 约为 70，此后逐渐减小）
const KAPPA = 0.2;        // 同时到达的格子给行棋方的分数
const WIN = 10000;
const SEP_BONUS = 200;

const qbuf = new Int32Array(NN * 8);
const POW2 = new Float64Array(INF + 1);
for (let i = 0; i <= INF; i++) POW2[i] = Math.pow(2, -i);

// 快速后距离 BFS（结果写入 out）
function queenDist(cells, queens, out) {
  out.fill(INF);
  let h = 0, t = 0;
  for (let i = 0; i < 4; i++) { const s = queens[i]; out[s] = 0; qbuf[t++] = s; }
  while (h < t) {
    const x = qbuf[h++], d = out[x] + 1, rays = RAYS[x];
    for (let k = 0; k < 8; k++) {
      const ray = rays[k];
      for (let j = 0; j < ray.length; j++) {
        const y = ray[j]; if (cells[y] !== EMPTY) break;
        if (out[y] > d) { out[y] = d; qbuf[t++] = y; }
      }
    }
  }
  return out;
}
function kingDist(cells, queens, out) {
  out.fill(INF);
  let h = 0, t = 0;
  for (let i = 0; i < 4; i++) { const s = queens[i]; out[s] = 0; qbuf[t++] = s; }
  while (h < t) {
    const x = qbuf[h++], d = out[x] + 1, nb = NEIGH[x];
    for (let j = 0; j < nb.length; j++) { const y = nb[j]; if (cells[y] === EMPTY && out[y] > d) { out[y] = d; qbuf[t++] = y; } }
  }
  return out;
}
function queenMobility(cells, q) {
  let n = 0; const rays = RAYS[q];
  for (let k = 0; k < 8; k++) { const ray = rays[k]; for (let j = 0; j < ray.length; j++) { if (cells[ray[j]] !== EMPTY) break; n++; } }
  return n;
}

const dW = new Uint8Array(NN), dB = new Uint8Array(NN), kW = new Uint8Array(NN), kB = new Uint8Array(NN);

/**
 * 计算特征（白方视角）。返回 { f: Float64Array(5), p, w, contested, regionW, regionB }
 * 行棋方 side 决定 κ 的符号。
 */
function features(b, out = new Float64Array(NF)) {
  const cells = b.cells, qW = b.queens[WHITE], qB = b.queens[BLACK];
  queenDist(cells, qW, dW); queenDist(cells, qB, dB);
  kingDist(cells, qW, kW); kingDist(cells, qB, kB);
  const kap = b.side === WHITE ? KAPPA : -KAPPA;
  let t1 = 0, t2 = 0, c1 = 0, c2 = 0, w = 0, contested = 0, rW = 0, rB = 0;
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== EMPTY) continue;
    const a = dW[i], c = dB[i];
    if (a < INF) rW++;
    if (c < INF) rB++;
    if (a === INF && c === INF) continue;
    if (a < c) t1 += 1; else if (a > c) t1 -= 1; else t1 += kap;
    const ka = kW[i], kc = kB[i];
    if (ka < kc) t2 += 1; else if (ka > kc) t2 -= 1; else if (ka < INF) t2 += kap;
    c1 += 2 * (POW2[a] - POW2[c]);
    let v = (kc - ka) / 6; if (v > 1) v = 1; else if (v < -1) v = -1;
    c2 += v;
    if (a < INF && c < INF) { contested++; const diff = a > c ? a - c : c - a; w += POW2[diff]; }
  }
  let mob = 0;
  for (let i = 0; i < 4; i++) { const m = queenMobility(cells, qW[i]); mob += m < 12 ? m : 12; }
  for (let i = 0; i < 4; i++) { const m = queenMobility(cells, qB[i]); mob -= m < 12 ? m : 12; }
  out[0] = t1; out[1] = t2; out[2] = c1; out[3] = c2; out[4] = mob / 4;
  const p = w / W0 > 1 ? 1 : w / W0;
  return { f: out, p, w, contested, regionW: rW, regionB: rB };
}

// 分隔后的区域格数：用王距离可达的空格数（剩余步数的上界）
function separatedScore(b, info) {
  // info.regionW/B 用后距离可达性统计；分隔后与王距离可达性一致（同一个连通区域）
  const own = b.side === WHITE ? info.regionW : info.regionB;
  const opp = b.side === WHITE ? info.regionB : info.regionW;
  const diff = own - opp - 0.5;            // 步数相同时行棋方先用完，所以减 0.5
  return (diff > 0 ? SEP_BONUS : -SEP_BONUS) + diff;
}

const fbuf = new Float64Array(NF);
/** 行棋方视角的评估值 */
function evaluate(b, weights = DEFAULT_WEIGHTS) {
  if (!b.canMove(b.side)) return -WIN;
  const info = features(b, fbuf);
  if (info.contested === 0 && !queensTouch(b.cells, b.queens[WHITE])) return separatedScore(b, info);
  const p = info.p, f = info.f;
  let s = 0;
  for (let k = 0; k < NF; k++) s += (p * weights[k] + (1 - p) * weights[NF + k]) * f[k];
  return b.side === WHITE ? s : -s;
}

/**
 * 判断是否已分隔：在“空格 + 后所在格”构成的 8 邻域连通分量中，没有任何一个分量同时含有双方的后。
 * 注意：只检查“没有空格同时可被双方到达”是不够的——两个敌对的后紧挨着、彼此之间没有空格时，
 * 任何一方把后移开，空出的格子就会把两块区域连通（第一版实现正是这样判断的，见 5.10 节）。
 */
const stk = new Int8Array(NN), seen = new Uint8Array(NN);
function separated(b) {
  const cells = b.cells;
  queenDist(cells, b.queens[WHITE], dW); queenDist(cells, b.queens[BLACK], dB);
  for (let i = 0; i < NN; i++) if (cells[i] === EMPTY && dW[i] < INF && dB[i] < INF) return false;
  return !queensTouch(cells, b.queens[WHITE]);
}
// 从白方的后出发，在非箭的格子上做 8 邻域洪泛，若能碰到黑方的后则返回 true
function queensTouch(cells, qW) {
  seen.fill(0); let top = 0;
  for (const q of qW) { seen[q] = 1; stk[top++] = q; }
  while (top) {
    const x = stk[--top];
    for (const y of C.NEIGH[x]) {
      if (seen[y]) continue;
      const v = cells[y];
      if (v === ARROW) continue;
      if (v === BLACK) return true;
      seen[y] = 1; stk[top++] = y;
    }
  }
  return false;
}

/** Texel 用：返回 10 维线性特征（白方视角）与是否分隔 */
function texelFeatures(b) {
  const info = features(b, new Float64Array(NF));
  const x = new Array(2 * NF);
  for (let k = 0; k < NF; k++) { x[k] = info.p * info.f[k]; x[NF + k] = (1 - info.p) * info.f[k]; }
  return { x, separated: info.contested === 0 && !queensTouch(b.cells, b.queens[WHITE]), p: info.p, w: info.w, regionW: info.regionW, regionB: info.regionB };
}

/** 供界面使用：每个空格的归属（1 白 / -1 黑 / 0 均势 / null 无人可达）与双方后距离 */
function territoryMap(b) {
  const cells = b.cells;
  const a = queenDist(cells, b.queens[WHITE], new Uint8Array(NN));
  const c = queenDist(cells, b.queens[BLACK], new Uint8Array(NN));
  const own = new Array(NN).fill(null);
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== EMPTY) continue;
    if (a[i] === INF && c[i] === INF) own[i] = null;
    else own[i] = a[i] < c[i] ? 1 : a[i] > c[i] ? -1 : 0;
  }
  return { owner: own, dW: Array.from(a), dB: Array.from(c) };
}

module.exports = { FEATURES, NF, DEFAULT_WEIGHTS, W0, KAPPA, WIN, SEP_BONUS, evaluate, separated, features, texelFeatures, territoryMap, queenDist, kingDist, queenMobility };
