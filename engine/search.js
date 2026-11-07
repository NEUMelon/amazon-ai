/*
 * search.js — α-β 博弈树搜索
 *
 * 负极大值（negamax）形式的 α-β 剪枝 + 迭代加深，辅以：
 *   置换表（Zobrist 哈希，存储深度、分数类型与最佳着法）；
 *   杀手着法与历史启发；
 *   主变例搜索（PVS，零窗口试探 + 失败重搜）；
 *   束宽剪枝：每个结点只搜索排序后的前 width 个走法（排序方式见 candidates）；
 *   根结点用更宽的候选集合（rootPre 个候选，全部按静态评估排序，搜索前 rootWidth 个）。
 * 每一项都可以通过选项关闭，用于消融实验（第 5.4 节）。
 */
'use strict';
const C = require('./core.js');
const E = require('./eval.js');
const M = require('./movegen.js');

const WIN = E.WIN, WIN_BOUND = WIN - 500;
const INF = 1e9;
const EXACT = 0, LOWER = 1, UPPER = 2;

class TimeUp extends Error {}

const DEFAULTS = {
  timeMs: 200, maxDepth: 30,
  useTT: true, useKillers: true, useHistory: true, usePVS: true,
  order: 'sep',                // 内部结点的排序方式：'sep' 可分离评估 / 'cheap' 廉价分数 + 静态评估
  leafOrder: 'cheap',          // 剩余深度为 1 的结点：'cheap' 取廉价分数前 preWidth 个全部评估 / 'sep'
  width: 8, preWidth: 24,      // 内部结点束宽；廉价候选数
  rootPre: 60, rootWidth: 30,  // 根结点：候选数 → 静态评估排序 → 搜索前 rootWidth 个
  weights: null,               // 评估权重（null 表示默认手工权重）
  ttBits: 18,
};

class AlphaBeta {
  constructor(opts = {}) {
    this.o = Object.assign({}, DEFAULTS, opts);
    this.w = this.o.weights || E.DEFAULT_WEIGHTS;
    const size = 1 << this.o.ttBits;
    this.ttMask = size - 1;
    if (this.o.useTT) {
      this.ttKey = new Int32Array(size); this.ttKey2 = new Int32Array(size);
      this.ttDepth = new Int8Array(size).fill(-1); this.ttFlag = new Int8Array(size);
      this.ttVal = new Float64Array(size); this.ttMove = new Int32Array(size);
    }
    this.history = new Float64Array(100 * 100 * 2);
  }

  evaluate(b) { return E.evaluate(b, this.w); }

  /**
   * 候选生成：返回按优先级排序的走法数组。
   *  order='sep'  ：内部结点用可分离评估排序取前 width 个（movegen.js）；
   *  order='cheap'：内部结点先按廉价分数取 preWidth 个，再逐个静态评估、取前 width 个；
   *  剩余深度为 1 的结点（子结点即叶结点）若 leafOrder='cheap'，直接取廉价分数前 preWidth 个，全部评估。
   *  根结点：取 rootPre 个候选，逐个静态评估排序，搜索前 rootWidth 个。
   */
  candidates(b, depth, ply, ttMove) {
    const o = this.o;
    let list;
    if (ply === 0) {
      const top = (o.order === 'sep' ? M.sepTopMoves(b, o.rootPre, this.w) : M.topMoves(b, o.rootPre)).moves;
      const sc = new Array(top.length);
      for (let i = 0; i < top.length; i++) { b.play(top[i]); sc[i] = -this.evaluate(b); b.undo(); }
      const idx = top.map((_, i) => i).sort((x, y) => sc[y] - sc[x] || x - y);
      list = idx.slice(0, o.rootWidth).map(i => top[i]);
      this.rootStatic = idx.map(i => ({ move: top[i], score: sc[i] }));
    } else if (depth === 1 && o.leafOrder === 'cheap') {
      list = M.topMoves(b, o.preWidth).moves;
    } else if (o.order === 'sep') {
      list = M.sepTopMoves(b, o.width, this.w).moves;
    } else {
      const top = M.topMoves(b, o.preWidth).moves;
      if (depth >= 2) {
        const sc = new Array(top.length);
        for (let i = 0; i < top.length; i++) { b.play(top[i]); sc[i] = -this.evaluate(b); b.undo(); }
        list = top.map((_, i) => i).sort((x, y) => sc[y] - sc[x] || x - y).slice(0, o.width).map(i => top[i]);
      } else list = top;
    }
    // 杀手着法与历史启发：稳定地把它们提前
    if (ply !== 0 && (o.useKillers || o.useHistory)) {
      const k = this.killers[ply] || [];
      const pri = new Map();
      list.forEach((m, i) => {
        let p = -i;                                         // 原顺序
        if (o.useHistory) p += Math.min(4, this.history[(C.mFrom(m) * 100 + C.mTo(m)) * 2 + (b.side - 1)] / 1e3);
        if (o.useKillers && (m === k[0] || m === k[1])) p += 1000;
        pri.set(m, p);
      });
      list.sort((x, y) => pri.get(y) - pri.get(x));
    }
    if (ttMove > 0) {
      const j = list.indexOf(ttMove);
      if (j > 0) { list.splice(j, 1); list.unshift(ttMove); }
      else if (j < 0 && b.isLegal(ttMove)) list.unshift(ttMove);
    }
    return list;
  }

  search(b0) {
    const o = this.o;
    const b = b0.clone();
    this.t0 = Date.now(); this.deadline = this.t0 + o.timeMs;
    this.nodes = 0; this.cutoffs = 0; this.firstCutoffs = 0; this.ttHits = 0; this.interior = 0; this.killers = []; this.history.fill(0); this.lastBest = 0; this.rootStatic = null;
    if (o.useTT) this.ttDepth.fill(-1);
    const iters = [];
    let best = -1, bestScore = 0, depthDone = 0, pv = [], rootScores = [], partialUsed = false;
    for (let d = 1; d <= o.maxDepth; d++) {
      this.rootDepth = d;
      try {
        const r = this.root(b, d);
        best = r.move; bestScore = r.score; depthDone = d; rootScores = r.scores;
        pv = this.extractPV(b, best, d);
        iters.push({ depth: d, move: C.moveToStr(best), score: +bestScore.toFixed(2), nodes: this.nodes, ms: Date.now() - this.t0 });
        if (o.onIteration) o.onIteration(Object.assign({ pv: pv.map(C.moveToStr) }, iters[iters.length - 1]));
        if (Math.abs(bestScore) > WIN_BOUND) break;          // 已找到胜负
        const el = Date.now() - this.t0;
        if (el > o.timeMs * 0.5) break;                      // 剩余时间不足一半时不再开始新的一层
      } catch (e) {
        if (!(e instanceof TimeUp)) throw e;
        // 未完成的一层：若上一层的最佳着法已在本层搜完，则可采用本层已搜完部分中的最佳着法
        const p = this.partial;
        if (p && p.count >= 1 && p.move !== best) {
          best = p.move; bestScore = p.score; partialUsed = true;
          iters.push({ depth: d, move: C.moveToStr(best), score: +bestScore.toFixed(2), nodes: this.nodes, ms: Date.now() - this.t0, partial: p.count });
        }
        break;
      }
    }
    if (best < 0) best = this.rootStatic && this.rootStatic.length ? this.rootStatic[0].move : b.genMoves()[0];
    return {
      move: best, score: bestScore, depth: depthDone, nodes: this.nodes, timeMs: Date.now() - this.t0,
      reason: 'search', pv: pv.map(C.moveToStr), iterations: iters, partialUsed,
      stats: { cutoffs: this.cutoffs, firstCutoffs: this.firstCutoffs, ttHits: this.ttHits, interior: this.interior },
      rootMoves: rootScores.slice(0, 12).map(x => ({ move: x.move, score: x.score })),
    };
  }

  root(b, depth) {
    const o = this.o;
    const moves = this.candidates(b, depth, 0, depth > 1 ? this.lastBest : 0);
    let alpha = -INF, beta = INF, best = moves[0], bestV = -INF;
    const scores = [];
    this.partial = null;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      b.play(m);
      let v;
      if (i === 0 || !o.usePVS) v = -this.negamax(b, depth - 1, -beta, -alpha, 1);
      else {
        v = -this.negamax(b, depth - 1, -alpha - 1e-6, -alpha, 1);
        if (v > alpha) v = -this.negamax(b, depth - 1, -beta, -alpha, 1);
      }
      b.undo();
      scores.push({ move: m, score: v });
      if (v > bestV) { bestV = v; best = m; }
      if (v > alpha) alpha = v;
      this.partial = { move: best, score: bestV, count: i + 1 };
    }
    this.lastBest = best;
    scores.sort((x, y) => y.score - x.score);
    return { move: best, score: bestV, scores };
  }

  negamax(b, depth, alpha, beta, ply) {
    const o = this.o;
    if ((++this.nodes & 7) === 0 && Date.now() > this.deadline) throw new TimeUp();
    if (!b.canMove(b.side)) return -WIN + ply;
    if (depth <= 0) return this.evaluate(b);
    const a0 = alpha;
    let ttMove = 0, slot = -1;
    if (o.useTT) {
      slot = b.hashLo & this.ttMask;
      if (this.ttKey[slot] === b.hashLo && this.ttKey2[slot] === b.hashHi && this.ttDepth[slot] >= 0) {
        ttMove = this.ttMove[slot];
        if (this.ttDepth[slot] >= depth) {
          const v = this.ttVal[slot], f = this.ttFlag[slot];
          this.ttHits++;
          if (f === EXACT) return v;
          if (f === LOWER && v >= beta) return v;
          if (f === UPPER && v <= alpha) return v;
        }
      }
    }
    const sv = this.evaluate(b);
    if (Math.abs(sv) >= E.SEP_BONUS - 60 && Math.abs(sv) < WIN_BOUND) return sv;   // 已分隔：区域计数即为估计
    const moves = this.candidates(b, depth, ply, ttMove);
    this.interior++;
    let best = -INF, bestM = moves[0];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      b.play(m);
      let v;
      if (i === 0 || !o.usePVS) v = -this.negamax(b, depth - 1, -beta, -alpha, ply + 1);
      else {
        v = -this.negamax(b, depth - 1, -alpha - 1e-6, -alpha, ply + 1);
        if (v > alpha && v < beta) v = -this.negamax(b, depth - 1, -beta, -alpha, ply + 1);
      }
      b.undo();
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        this.cutoffs++; if (i === 0) this.firstCutoffs++;
        if (o.useKillers) {
          const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
        }
        if (o.useHistory) this.history[(C.mFrom(m) * 100 + C.mTo(m)) * 2 + (b.side - 1)] += depth * depth;
        break;
      }
    }
    if (o.useTT) {
      this.ttKey[slot] = b.hashLo; this.ttKey2[slot] = b.hashHi; this.ttDepth[slot] = depth;
      this.ttVal[slot] = best; this.ttMove[slot] = bestM;
      this.ttFlag[slot] = best <= a0 ? UPPER : best >= beta ? LOWER : EXACT;
    }
    return best;
  }

  extractPV(b, first, depth) {
    const pv = [first];
    if (!this.o.useTT) return pv;
    const c = b.clone(); c.play(first);
    for (let i = 1; i < depth; i++) {
      const slot = c.hashLo & this.ttMask;
      if (!(this.ttKey[slot] === c.hashLo && this.ttKey2[slot] === c.hashHi && this.ttDepth[slot] >= 0)) break;
      const m = this.ttMove[slot];
      if (!c.isLegal(m)) break;
      pv.push(m); c.play(m);
    }
    return pv;
  }
}

module.exports = { AlphaBeta, DEFAULTS, WIN, WIN_BOUND, TimeUp };
