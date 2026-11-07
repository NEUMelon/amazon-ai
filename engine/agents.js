/*
 * agents.js — 统一的智能体接口与预设配置
 *
 * 每个智能体实现 think(board) → { move, ...诊断信息 }。
 * 实验脚本、网页界面与单元测试都通过 makeAgent(name, overrides) 创建智能体，
 * 保证“游戏里运行的算法”与“报告中测量的算法”是同一份代码。
 *
 * 双方被完全分隔后（填格阶段），除随机智能体外，所有智能体都改用同一个填格策略 fillerMove，
 * 使实验比较集中在双方仍有接触的阶段（第 2.6 节）。
 */
'use strict';
const C = require('./core.js');
const E = require('./eval.js');
const M = require('./movegen.js');
const { AlphaBeta } = require('./search.js');
const { MCTS } = require('./mcts.js');
const { LinearPolicy } = require('./policy.js');

/**
 * 填格策略：在已分隔的局面中，选择走完后“己方可达空格数”最大的走法；
 * 同分时优先把箭射在周围空格最少的位置（先填死角，减少对自身区域的切割）。
 */
const kbuf = new Uint8Array(C.NN);
function reachable(b, side) {
  E.kingDist(b.cells, b.queens[side], kbuf);
  let n = 0; for (let i = 0; i < C.NN; i++) if (b.cells[i] === C.EMPTY && kbuf[i] < C.INF) n++;
  return n;
}
function fillerMove(b) {
  const s = b.side, ms = b.genMoves();
  let best = ms[0], bv = -Infinity;
  for (const m of ms) {
    const a = C.mArrow(m);
    b.play(m);
    let free = 0; for (const x of C.NEIGH[a]) if (b.cells[x] === C.EMPTY) free++;
    const v = reachable(b, s) * 10 - free;
    b.undo();
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

function maybeFiller(b, o, t0) {
  if (o.filler === false) return null;
  if (!E.separated(b)) return null;
  return { move: fillerMove(b), reason: 'filler', score: E.evaluate(b, o.weights || undefined), timeMs: Date.now() - t0 };
}

class RandomAgent {
  constructor(o = {}) { this.rng = C.mulberry32(o.seed || 1); this.o = o; }
  think(b) {
    const t0 = Date.now();
    const ms = b.genMoves();
    return { move: ms[(this.rng() * ms.length) | 0], reason: 'random', timeMs: Date.now() - t0 };
  }
}

/** 一步贪心：枚举全部合法走法，取走完后静态评估最好的一步 */
class GreedyAgent {
  constructor(o = {}) { this.o = o; this.w = o.weights || E.DEFAULT_WEIGHTS; }
  think(b0) {
    const t0 = Date.now();
    const f = maybeFiller(b0, this.o, t0); if (f) return f;
    const b = b0.clone();
    let best = -1, bv = -Infinity;
    for (const m of b.genMoves()) { b.play(m); const v = -E.evaluate(b, this.w); b.undo(); if (v > bv) { bv = v; best = m; } }
    return { move: best, reason: 'greedy', score: bv, timeMs: Date.now() - t0 };
  }
}

class ABAgent {
  constructor(o = {}) { this.o = o; this.engine = new AlphaBeta(o); }
  think(b) { const f = maybeFiller(b, this.o, Date.now()); return f || this.engine.search(b); }
}
class MCTSAgent {
  constructor(o = {}) { this.o = o; this.engine = new MCTS(o); }
  think(b) { const f = maybeFiller(b, this.o, Date.now()); return f || this.engine.search(b); }
}

// 预设：实验与界面共用
const PRESETS = {
  'random': { kind: 'random' },
  'greedy': { kind: 'greedy' },
  // α-β 完整版与消融
  'ab': { kind: 'ab' },
  'ab-noTT': { kind: 'ab', useTT: false },
  'ab-noKiller': { kind: 'ab', useKillers: false, useHistory: false },
  'ab-noPVS': { kind: 'ab', usePVS: false },
  'ab-cheapOrder': { kind: 'ab', order: 'cheap' },
  'ab-sepLeaf': { kind: 'ab', leafOrder: 'sep' },
  'ab-wide': { kind: 'ab', width: 16, preWidth: 48, rootPre: 120, rootWidth: 60 },
  'ab-narrow': { kind: 'ab', width: 4, preWidth: 12, rootPre: 30, rootWidth: 15 },
  'ab-simpleEval': { kind: 'ab', weights: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0] },
  'ab-tuned': { kind: 'ab', weights: 'tuned' },
  'ab-plain': { kind: 'ab', useTT: false, useKillers: false, useHistory: false, usePVS: false },
  // MCTS 系列
  'mcts-pure': { kind: 'mcts', selection: 'uct', order: 'random', pw: false, rollout: 'random', sepCheck: false, winCheck: false, filler: false },
  'mcts-uct': { kind: 'mcts', selection: 'uct', order: 'random', pw: false, rollout: 'cutoff' },
  'mcts-pw': { kind: 'mcts', selection: 'uct', order: 'heuristic', pw: true, rollout: 'random' },
  'mcts-cutoff': { kind: 'mcts', selection: 'uct', order: 'heuristic', pw: true, rollout: 'cutoff' },
  'mcts-sep': { kind: 'mcts', selection: 'uct', order: 'sep', pw: true, rollout: 'cutoff', maxCand: 30 },
  'mcts-puct': { kind: 'mcts', selection: 'puct', order: 'sep', pw: true, rollout: 'cutoff', maxCand: 30 },
  'mcts-learned': { kind: 'mcts', selection: 'puct', order: 'learned', pw: true, rollout: 'cutoff', maxCand: 30 },
};

let POLICY_THETA = null;
let TUNED_WEIGHTS = null;
function setPolicyTheta(theta) { POLICY_THETA = theta; }
function setTunedWeights(w) { TUNED_WEIGHTS = w; }

function makeAgent(name, overrides = {}) {
  const base = PRESETS[name];
  if (!base) throw new Error('unknown agent ' + name);
  const o = Object.assign({}, base, overrides);
  if (o.weights === 'tuned') {
    if (!TUNED_WEIGHTS) throw new Error('tuned weights not loaded');
    o.weights = TUNED_WEIGHTS;
  }
  if (o.order === 'learned' && !o.policyModel) {
    if (!POLICY_THETA) throw new Error('policy weights not loaded');
    o.policyModel = new LinearPolicy(POLICY_THETA);
  }
  switch (o.kind) {
    case 'random': return new RandomAgent(o);
    case 'greedy': return new GreedyAgent(o);
    case 'ab': return new ABAgent(o);
    case 'mcts': return new MCTSAgent(o);
  }
  throw new Error('bad kind');
}

module.exports = { RandomAgent, GreedyAgent, ABAgent, MCTSAgent, PRESETS, makeAgent, setPolicyTheta, setTunedWeights, fillerMove };
