/*
 * mcts.js — 蒙特卡洛树搜索
 *
 * 四个步骤：选择（UCT 或 PUCT）、扩展、模拟、回传。可配置的部分：
 *   order   ：子结点的展开顺序。'random' 为随机打乱全部合法走法；'heuristic' 为按廉价分数
 *             取前 maxCand 个；'sep' 为按可分离评估排序取前 maxCand 个；'learned' 为按学习策略的概率排序（同时提供 PUCT 先验）。
 *   pw      ：渐进展开（progressive widening），结点访问 n 次时最多展开 ⌈pwC·n^pwA⌉ 个子结点；
 *             关闭时每次访问展开一个新子结点，直到全部展开（标准 UCT）。
 *   rollout ：'random' 随机下到终局；'cutoff' 随机走 cutoff 步后用评估函数估计胜率（Lorentz 2008）；
 *             'eval' 不模拟，直接评估叶结点。
 *   sepCheck：双方已被分隔时，直接用区域格数判定胜负，不再模拟。
 * 胜率估计 p = 1 / (1 + exp(−k·v))，v 为评估值（行棋方视角）。
 */
'use strict';
const C = require('./core.js');
const E = require('./eval.js');
const M = require('./movegen.js');

const DEFAULTS = {
  timeMs: 200, maxSims: 0, seed: 1,
  selection: 'uct', cUct: 0.5, cPuct: 1.5,
  order: 'heuristic', maxCand: 60, tau: 4,
  pw: true, pwC: 2, pwA: 0.5,
  rollout: 'cutoff', cutoff: 4, k: 0.18,
  sepCheck: true, winCheck: true, weights: null, policyModel: null,
};

class Node {
  constructor(parent, move, prior) {
    this.parent = parent; this.move = move; this.prior = prior;
    this.children = []; this.n = 0; this.w = 0;            // w：从“走入本结点的一方”看的累计收益
    this.cand = null; this.candP = null; this.next = 0;    // 待展开的候选走法
    this.terminal = 0;                                     // 1：走入本结点的一方已获胜（对方无子可动）
  }
}

class MCTS {
  constructor(opts = {}) {
    this.o = Object.assign({}, DEFAULTS, opts);
    this.rng = C.mulberry32(this.o.seed || 1);
    this.w = this.o.weights || E.DEFAULT_WEIGHTS;
  }

  initCandidates(node, b) {
    const o = this.o;
    if (o.order === 'random') {
      const ms = b.genMoves();
      for (let i = ms.length - 1; i > 0; i--) { const j = (this.rng() * (i + 1)) | 0; const t = ms[i]; ms[i] = ms[j]; ms[j] = t; }
      node.cand = ms; node.candP = null;
    } else if (o.order === 'learned') {
      const r = o.policyModel.rank(b, o.maxCand);
      node.cand = r.moves; node.candP = r.probs;
    } else {
      const r = o.order === 'sep' ? M.sepTopMoves(b, o.maxCand, this.w) : M.topMoves(b, o.maxCand);
      node.cand = r.moves;
      // 启发式先验：对排序分数做 softmax（仅在 PUCT 下使用；温度 tau）
      const mx = r.scores[0] || 0; let z = 0;
      const p = r.scores.map(s => { const e = Math.exp((s - mx) / o.tau); z += e; return e; });
      node.candP = p.map(x => x / z);
    }
  }

  canExpand(node) {
    if (node.next >= node.cand.length) return false;
    if (!this.o.pw) return true;
    return node.children.length < Math.ceil(this.o.pwC * Math.pow(node.n + 1, this.o.pwA));
  }

  select(node) {
    const o = this.o;
    let best = null, bv = -Infinity;
    const lnN = Math.log(node.n + 1), sq = Math.sqrt(node.n + 1);
    for (const c of node.children) {
      if (c.terminal) return c;                             // 一步制胜
      const q = c.n ? c.w / c.n : 0.5;
      const u = o.selection === 'puct'
        ? q + o.cPuct * c.prior * sq / (1 + c.n)
        : q + o.cUct * Math.sqrt(lnN / (c.n + 1e-9));
      if (u > bv) { bv = u; best = c; }
    }
    return best;
  }

  // 叶结点价值：返回“行棋方”的胜率估计
  leafValue(b) {
    const o = this.o;
    if (!b.canMove(b.side)) return 0;
    if (o.rollout === 'random') return this.randomPlayout(b, 400);
    if (o.rollout === 'eval') return this.evalToProb(b);
    // cutoff：随机走 cutoff 步后评估
    const s0 = b.side; let k = 0;
    for (; k < o.cutoff; k++) {
      if (!b.canMove(b.side)) break;
      b.play(b.randomMove(this.rng));
    }
    let v;
    if (!b.canMove(b.side)) v = b.side === s0 ? 0 : 1;
    else { const p = this.evalToProb(b); v = b.side === s0 ? p : 1 - p; }
    for (let i = 0; i < k; i++) b.undo();
    return v;
  }
  evalToProb(b) {
    const v = E.evaluate(b, this.w);
    return 1 / (1 + Math.exp(-this.o.k * v));
  }
  randomPlayout(b, cap) {
    const s0 = b.side; let k = 0;
    while (k < cap && b.canMove(b.side)) { b.play(b.randomMove(this.rng)); k++; }
    const v = b.canMove(b.side) ? 0.5 : (b.side === s0 ? 0 : 1);
    for (let i = 0; i < k; i++) b.undo();
    return v;
  }

  search(b0) {
    const o = this.o;
    const b = b0.clone();
    const t0 = Date.now(), deadline = t0 + o.timeMs;
    const root = new Node(null, -1, 1);
    this.initCandidates(root, b);
    // 一步制胜检查：走完后对方无子可动
    if (o.winCheck) for (const m of b.genMoves()) { b.play(m); const win = !b.canMove(b.side); b.undo(); if (win) return { move: m, reason: 'win', simulations: 0, winrate: 1, timeMs: Date.now() - t0 }; }
    let sims = 0, maxDepth = 0, depthSum = 0;
    while (true) {
      if (o.maxSims ? sims >= o.maxSims : ((sims & 15) === 0 && Date.now() >= deadline)) break;
      let node = root, d = 0;
      // 1. 选择 / 2. 扩展
      while (true) {
        if (node.terminal) break;
        if (!node.cand) this.initCandidates(node, b);
        if (this.canExpand(node)) {
          const m = node.cand[node.next];
          const p = node.candP ? node.candP[node.next] : 1 / node.cand.length;
          node.next++;
          const c = new Node(node, m, p);
          node.children.push(c);
          b.play(m); d++;
          if (!b.canMove(b.side)) c.terminal = 1;
          node = c;
          break;
        }
        if (!node.children.length) break;
        node = this.select(node);
        b.play(node.move); d++;
      }
      // 3. 模拟：value 为“走入 node 的一方”的收益
      let value;
      if (node.terminal) value = 1;
      else if (o.sepCheck && E.separated(b)) {
        const v = E.evaluate(b, this.w); value = v > 0 ? 0 : 1;
      } else value = 1 - this.leafValue(b);
      // 4. 回传
      for (let x = node; x; x = x.parent) { x.n++; x.w += value; value = 1 - value; }
      for (let i = 0; i < d; i++) b.undo();
      sims++; depthSum += d; if (d > maxDepth) maxDepth = d;
      if (o.onProgress && (sims & 63) === 0) {
        const now = Date.now();
        if (!this._lastProg || now - this._lastProg >= 150) {
          this._lastProg = now;
          let bc = null; for (const c of root.children) if (!bc || c.n > bc.n) bc = c;
          o.onProgress({ simulations: sims, ms: now - t0, best: C.moveToStr(bc.move), winrate: bc.w / Math.max(1, bc.n), maxDepth });
        }
      }
    }
    let best = null;
    for (const c of root.children) if (!best || c.n > best.n || (c.n === best.n && c.w > best.w)) best = c;
    if (!best) { const ms = M.topMoves(b, 1).moves; return { move: ms[0], reason: 'fallback', simulations: sims, winrate: 0.5, timeMs: Date.now() - t0 }; }
    const kids = root.children.slice().sort((x, y) => y.n - x.n);
    // 主变例：沿访问次数最多的子结点下降
    const pv = []; for (let x = best; x; ) { pv.push(C.moveToStr(x.move)); let nb = null; for (const c of x.children) if (!nb || c.n > nb.n) nb = c; if (!nb || nb.n < 2) break; x = nb; if (pv.length >= 8) break; }
    return {
      move: best.move, reason: 'mcts', simulations: sims, winrate: best.w / Math.max(1, best.n),
      selDepth: maxDepth, avgDepth: sims ? depthSum / sims : 0, timeMs: Date.now() - t0, pv,
      rootChildren: root.children.length,
      rootMoves: kids.slice(0, 12).map(c => ({ move: c.move, visits: c.n, winrate: c.n ? c.w / c.n : 0, prior: c.prior })),
    };
  }
}

module.exports = { MCTS, DEFAULTS };
