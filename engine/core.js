'use strict';
/*
 * core.js —— 10×10 亚马逊棋的棋盘表示、走法生成与距离计算
 *
 * 规则要点：
 *   1. 双方各有 4 个“亚马逊”（后），白方先行；
 *   2. 一步棋 = 移动一个己方的后（像国际象棋的后一样沿 8 个方向直线移动任意格，不能越过任何棋子或障碍）
 *      + 从落点再像后一样射出一支“箭”，箭落的格子永久成为障碍；
 *   3. 轮到某方时若无合法走法，该方判负（不存在和棋）。
 *
 * 表示：格点编号 idx = r * 10 + c，r = 0 为最上一行（第 10 行），c = 0 为 a 列。
 *       cells[idx]：0 空，1 白后，2 黑后，3 箭（障碍）。
 *       一步棋编码为整数 from * 10000 + to * 100 + arrow，字符串形如 "d1-d7/g7"。
 */
const N = 10, NN = 100;
const EMPTY = 0, WHITE = 1, BLACK = 2, ARROW = 3;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const INF = 99;

// 射线表：RAYS[idx][d] = 从 idx 出发沿方向 d 依次经过的格点（不含 idx）
const RAYS = [];
const NEIGH = [];          // 8 邻域
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const rays = [], nb = [];
  for (const [dr, dc] of DIRS) {
    const ray = [];
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N) { ray.push(rr * N + cc); rr += dr; cc += dc; }
    rays.push(ray);
    if (ray.length) nb.push(ray[0]);
  }
  RAYS.push(rays); NEIGH.push(nb);
}

// Zobrist 随机数（两段 32 位，避免 JS 位运算的 53 位限制）
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const zr = mulberry32(20241107);
const ZLO = [], ZHI = [];
for (let i = 0; i < NN * 4; i++) { ZLO.push((zr() * 4294967296) >>> 0); ZHI.push((zr() * 4294967296) >>> 0); }
const ZSIDE_LO = (zr() * 4294967296) >>> 0, ZSIDE_HI = (zr() * 4294967296) >>> 0;

const COLS = 'abcdefghij';
const sqToStr = i => COLS[i % N] + (N - ((i / N) | 0));
function strToSq(s) {
  const c = COLS.indexOf(s[0].toLowerCase()), row = parseInt(s.slice(1), 10);
  if (c < 0 || !(row >= 1 && row <= N)) throw new Error('bad square ' + s);
  return (N - row) * N + c;
}
const mFrom = m => (m / 10000) | 0, mTo = m => ((m / 100) | 0) % 100, mArrow = m => m % 100;
const mk = (f, t, a) => f * 10000 + t * 100 + a;
const moveToStr = m => `${sqToStr(mFrom(m))}-${sqToStr(mTo(m))}/${sqToStr(mArrow(m))}`;
function parseMove(s) {
  const m = /^([a-j]\d{1,2})-([a-j]\d{1,2})\/([a-j]\d{1,2})$/i.exec(s.trim());
  if (!m) throw new Error('bad move ' + s);
  return mk(strToSq(m[1]), strToSq(m[2]), strToSq(m[3]));
}

const START_WHITE = ['a4', 'd1', 'g1', 'j4'].map(strToSq);
const START_BLACK = ['a7', 'd10', 'g10', 'j7'].map(strToSq);

class Board {
  constructor() {
    this.cells = new Int8Array(NN);
    this.queens = [null, START_WHITE.slice(), START_BLACK.slice()];
    for (const q of this.queens[WHITE]) this.cells[q] = WHITE;
    for (const q of this.queens[BLACK]) this.cells[q] = BLACK;
    this.side = WHITE;
    this.history = [];
    this.hashLo = 0; this.hashHi = 0;
    for (let i = 0; i < NN; i++) if (this.cells[i]) { this.hashLo ^= ZLO[i * 4 + this.cells[i]]; this.hashHi ^= ZHI[i * 4 + this.cells[i]]; }
  }
  static fromMoves(list) {
    const b = new Board();
    for (const s of list) {
      const m = typeof s === 'number' ? s : parseMove(s);
      if (!b.isLegal(m)) throw new Error('illegal move ' + (typeof s === 'number' ? moveToStr(s) : s));
      b.play(m);
    }
    return b;
  }
  clone() {
    const b = Object.create(Board.prototype);
    b.cells = this.cells.slice(); b.queens = [null, this.queens[1].slice(), this.queens[2].slice()];
    b.side = this.side; b.history = this.history.slice(); b.hashLo = this.hashLo; b.hashHi = this.hashHi;
    return b;
  }
  get arrows() { return this.history.length; }
  _set(i, v) {
    const old = this.cells[i];
    if (old) { this.hashLo ^= ZLO[i * 4 + old]; this.hashHi ^= ZHI[i * 4 + old]; }
    this.cells[i] = v;
    if (v) { this.hashLo ^= ZLO[i * 4 + v]; this.hashHi ^= ZHI[i * 4 + v]; }
  }
  play(m) {
    const f = mFrom(m), t = mTo(m), a = mArrow(m), s = this.side;
    const qs = this.queens[s]; qs[qs.indexOf(f)] = t;
    this._set(f, EMPTY); this._set(t, s); this._set(a, ARROW);
    this.history.push(m);
    this.side = 3 - s; this.hashLo ^= ZSIDE_LO; this.hashHi ^= ZSIDE_HI;
  }
  undo() {
    const m = this.history.pop();
    const f = mFrom(m), t = mTo(m), a = mArrow(m), s = 3 - this.side;
    this.side = s; this.hashLo ^= ZSIDE_LO; this.hashHi ^= ZSIDE_HI;
    this._set(a, EMPTY); this._set(t, EMPTY); this._set(f, s);
    const qs = this.queens[s]; qs[qs.indexOf(t)] = f;
  }
  lastMove() { return this.history.length ? this.history[this.history.length - 1] : -1; }
  // 某方是否还有合法走法：只要某个后旁边有空格，就可以走一步再把箭射回原处
  canMove(side = this.side) {
    for (const q of this.queens[side]) for (const n of NEIGH[q]) if (this.cells[n] === EMPTY) return true;
    return false;
  }
  isOver() { return !this.canMove(this.side); }
  get winner() { return this.isOver() ? 3 - this.side : 0; }
  // 一个后从 q 出发一步能到达的空格（目的地）
  queenTargets(q, out = []) {
    const rays = RAYS[q], cells = this.cells;
    for (let d = 0; d < 8; d++) { const ray = rays[d]; for (let k = 0; k < ray.length; k++) { const x = ray[k]; if (cells[x] !== EMPTY) break; out.push(x); } }
    return out;
  }
  // 全部合法走法（整数编码）。开局时约 2176 步
  genMoves(side = this.side) {
    const out = [], cells = this.cells;
    for (const f of this.queens[side]) {
      cells[f] = EMPTY;                                   // 射箭时原位置已空出
      const rays = RAYS[f];
      for (let d = 0; d < 8; d++) {
        const ray = rays[d];
        for (let k = 0; k < ray.length; k++) {
          const t = ray[k]; if (cells[t] !== EMPTY) break;
          const base = f * 10000 + t * 100, rt = RAYS[t];
          for (let e = 0; e < 8; e++) { const r2 = rt[e]; for (let j = 0; j < r2.length; j++) { const a = r2[j]; if (cells[a] !== EMPTY) break; out.push(base + a); } }
        }
      }
      cells[f] = side;
    }
    return out;
  }
  countMoves(side = this.side) {
    let n = 0; const cells = this.cells;
    for (const f of this.queens[side]) {
      cells[f] = EMPTY;
      for (const ray of RAYS[f]) for (const t of ray) { if (cells[t] !== EMPTY) break; for (const r2 of RAYS[t]) for (const a of r2) { if (cells[a] !== EMPTY) break; n++; } }
      cells[f] = side;
    }
    return n;
  }
  isLegal(m) {
    if (!(m >= 0)) return false;
    const f = mFrom(m), t = mTo(m), a = mArrow(m);
    if (f >= NN || t >= NN || a >= NN || this.cells[f] !== this.side || this.isOver()) return false;
    if (!this._reach(f, t)) return false;
    this.cells[f] = EMPTY; const ok = this._reach(t, a); this.cells[f] = this.side;
    return ok;
  }
  _reach(f, t) {
    for (const ray of RAYS[f]) for (const x of ray) { if (this.cells[x] !== EMPTY) break; if (x === t) return true; }
    return false;
  }
  // 随机走法（不生成全部走法）：随机选后、方向、距离，再随机选箭。用于快速随机模拟
  randomMove(rng, side = this.side) {
    const cells = this.cells, qs = this.queens[side];
    for (let tries = 0; tries < 64; tries++) {
      const f = qs[(rng() * 4) | 0];
      const tg = this.queenTargets(f);
      if (!tg.length) continue;
      const t = tg[(rng() * tg.length) | 0];
      cells[f] = EMPTY;
      const ag = this.queenTargets(t);
      cells[f] = side;
      if (!ag.length) continue;                        // 理论上不会发生（至少能射回原处）
      return mk(f, t, ag[(rng() * ag.length) | 0]);
    }
    const all = this.genMoves(side);
    return all.length ? all[(rng() * all.length) | 0] : -1;
  }
  toString() {
    let s = '';
    for (let r = 0; r < N; r++) {
      s += String(N - r).padStart(2) + ' ';
      for (let c = 0; c < N; c++) s += '.WBx'[this.cells[r * N + c]] + ' ';
      s += '\n';
    }
    return s + '   ' + COLS.split('').join(' ');
  }
}

// ---------------------------------------------------------------- 距离计算
// 后距离（queen distance）：从某方任一后出发，最少需要几步“后的移动”能到达该格（不考虑对方阻挡的动态变化）
function queenDist(b, side, out = new Uint8Array(NN)) {
  out.fill(INF);
  const cells = b.cells, q = [];
  for (const s of b.queens[side]) { out[s] = 0; q.push(s); }
  let h = 0;
  while (h < q.length) {
    const x = q[h++], d = out[x] + 1, rays = RAYS[x];
    for (let k = 0; k < 8; k++) {
      const ray = rays[k];
      for (let j = 0; j < ray.length; j++) {
        const y = ray[j]; if (cells[y] !== EMPTY) break;
        if (out[y] > d) { out[y] = d; q.push(y); }
        else if (out[y] < d) continue;
      }
    }
  }
  return out;
}
// 王距离（king distance）：每步只走一格（8 邻域）
function kingDist(b, side, out = new Uint8Array(NN)) {
  out.fill(INF);
  const cells = b.cells, q = [];
  for (const s of b.queens[side]) { out[s] = 0; q.push(s); }
  let h = 0;
  while (h < q.length) {
    const x = q[h++], d = out[x] + 1;
    for (const y of NEIGH[x]) if (cells[y] === EMPTY && out[y] > d) { out[y] = d; q.push(y); }
  }
  return out;
}
// 双方的后距离都有限的空格数；为 0 表示双方已被完全分隔（进入“填格”阶段）
function contestedCount(b, dW = queenDist(b, WHITE), dB = queenDist(b, BLACK)) {
  let n = 0;
  for (let i = 0; i < NN; i++) if (b.cells[i] === EMPTY && dW[i] < INF && dB[i] < INF) n++;
  return n;
}
// 已分隔：没有争夺格，且双方的后不在同一个“非箭格子”的 8 邻域连通分量中（敌对的后紧挨着时，移开一方即会重新连通）
function isSeparated(b) {
  if (contestedCount(b) !== 0) return false;
  const seen = new Uint8Array(NN), st = b.queens[WHITE].slice();
  for (const q of st) seen[q] = 1;
  while (st.length) { const x = st.pop(); for (const y of NEIGH[x]) { if (seen[y] || b.cells[y] === ARROW) continue; if (b.cells[y] === BLACK) return false; seen[y] = 1; st.push(y); } }
  return true;
}

module.exports = {
  N, NN, EMPTY, WHITE, BLACK, ARROW, INF, DIRS, RAYS, NEIGH, Board, mulberry32,
  sqToStr, strToSq, moveToStr, parseMove, mFrom, mTo, mArrow, mk, queenDist, kingDist, contestedCount, isSeparated,
};
