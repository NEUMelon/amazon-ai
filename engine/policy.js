/*
 * policy.js — 线性 softmax 走子策略
 *
 * π(m | s) ∝ exp(θ · φ(s, m))，φ 为 movegen.js 中定义的 11 维走法特征，外加该走法的
 * 可分离评估分数（相对于候选中最高分的差值，单位：格），共 12 维。
 * 由于合法走法太多，先用可分离评估取前 pre 个候选，再在候选集合内计算 softmax。
 * θ 由 learning/train_policy.py 从 α-β 自对弈棋谱中用最大似然拟合。
 */
'use strict';
const M = require('./movegen.js');

const NF = M.POLICY_FEATURES.length + 1;
/** 候选集合与特征矩阵（训练数据提取与推断共用，保证一致） */
function candidateFeatures(b, pre) {
  const r = M.sepTopMoves(b, pre);
  M.prepare(b);
  const feats = r.moves.map((m, i) => {
    const phi = new Float64Array(NF);
    M.moveFeatures(b, m, phi);
    phi[NF - 1] = (r.scores[i] - r.scores[0]) / 4;
    return phi;
  });
  return { moves: r.moves, sepScores: r.scores, feats };
}

class LinearPolicy {
  constructor(theta, pre = 40) { this.theta = theta; this.pre = pre; }
  /** 返回概率最高的 k 个走法及其（在候选集合内归一化的）概率 */
  rank(b, k) {
    const c = candidateFeatures(b, this.pre), th = this.theta;
    const cand = c.moves;
    const lg = c.feats.map(phi => { let z = 0; for (let i = 0; i < th.length; i++) z += th[i] * phi[i]; return z; });
    const mx = Math.max(...lg); let z = 0;
    const p = lg.map(x => { const e = Math.exp(x - mx); z += e; return e / 1; });
    const idx = cand.map((_, i) => i).sort((x, y) => p[y] - p[x] || x - y).slice(0, k);
    return { moves: idx.map(i => cand[i]), probs: idx.map(i => p[i] / z) };
  }
}

module.exports = { LinearPolicy, candidateFeatures, NF, FEATURE_NAMES: M.POLICY_FEATURES.concat(['sepScore']) };
