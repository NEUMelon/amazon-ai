'use strict';
// 生成各实验的对局任务清单（data/jobs/*.json）
const G = require('../engine');
const fs = require('fs');
const path = require('path');
const OP = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/openings.json'))).openings.map(o => o.moves);
const dir = path.join(__dirname, '../data/jobs'); fs.mkdirSync(dir, { recursive: true });
const save = (name, jobs) => { fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(jobs)); console.log(name, jobs.length); };

// 配对对局：每个开局两局，交换先后手（A 执白一局、执黑一局）
function pairJobs(tag, A, B, openings, seed0 = 1) {
  const jobs = [];
  openings.forEach((op, i) => {
    jobs.push({ id: `${tag}|${i}|AB`, tag, white: A, black: B, opening: op, seed: seed0 + i * 2 });
    jobs.push({ id: `${tag}|${i}|BA`, tag, white: B, black: A, opening: op, seed: seed0 + i * 2 + 1 });
  });
  return jobs;
}
module.exports = { pairJobs, OP };

if (require.main === module && process.argv[2] === 'selfplay') {
  // 学习数据：随机 2–4 手开局（每手从静态评估前 40 名中随机选取），双方为 200 ms 的 α-β
  const rng = G.mulberry32(777);
  const jobs = [];
  for (let i = 0; i < 400; i++) {
    const b = new G.Board();
    const k = 2 + ((rng() * 3) | 0);
    for (let j = 0; j < k; j++) {
      const ms = G.MoveGen.sepTopMoves(b, 40).moves;
      b.play(ms[(rng() * ms.length) | 0]);
    }
    const A = { agent: 'ab', opts: { timeMs: 200 } };
    jobs.push({ id: `sp|${i}`, tag: 'selfplay', white: A, black: A, opening: b.history.map(G.moveToStr), seed: i });
  }
  save('selfplay', jobs);
}

if (require.main === module && process.argv[2] === 'main') {
  const T = 200;                       // 标准思考时间（毫秒/步）
  const op16 = OP.slice(0, 16);        // 16 个均衡开局 × 交换先后 = 每组 32 局（开局 16–31 只用于参数试调，不用于正式实验）
  const A = (agent, opts = {}) => ({ agent, opts: Object.assign({ timeMs: T }, opts) });
  let all = [];
  // ---------------- 实验 T：循环赛（8 个智能体，两两 32 局）
  const pool = ['random', 'greedy', 'ab', 'ab-tuned', 'mcts-pure', 'mcts-cutoff', 'mcts-puct', 'mcts-learned'];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++)
    all.push(...pairJobs(`T:${pool[i]}~${pool[j]}`, A(pool[i]), A(pool[j]), op16, 1000 + i * 100 + j));
  // ---------------- 实验 A：α-β 消融（均与完整 α-β 对弈）
  const abVar = {
    'noTT': A('ab-noTT'), 'noKiller': A('ab-noKiller'), 'noPVS': A('ab-noPVS'), 'plain': A('ab-plain'),
    'cheapOrder': A('ab-cheapOrder'), 'sepLeaf': A('ab-sepLeaf'), 'wide': A('ab-wide'), 'narrow': A('ab-narrow'),
    'simpleEval': A('ab-simpleEval'), 'noMob': A('ab', { weights: [0.2, 0.2, 0.3, 0.3, 0, 1, 0.2, 0.05, 0.05, 0] }),
    'noPhase': A('ab', { weights: [0.6, 0.2, 0.175, 0.175, 0.15, 0.6, 0.2, 0.175, 0.175, 0.15] }),
  };
  for (const [k, v] of Object.entries(abVar)) all.push(...pairJobs(`A:${k}`, v, A('ab'), op16, 3000));
  // ---------------- 实验 M：MCTS 消融（均与 mcts-puct 对弈）
  const mv = {
    'uctSel': A('mcts-sep'), 'cheapOrder': A('mcts-puct', { order: 'heuristic', maxCand: 60 }), 'randomOrder': A('mcts-puct', { order: 'random', pw: false, selection: 'uct' }),
    'noPW': A('mcts-puct', { pw: false }), 'cand10': A('mcts-puct', { maxCand: 10 }), 'cand60': A('mcts-puct', { maxCand: 60 }),
    'rollEval': A('mcts-puct', { rollout: 'eval' }), 'cut2': A('mcts-puct', { cutoff: 2 }), 'cut8': A('mcts-puct', { cutoff: 8 }), 'rollRandom': A('mcts-puct', { rollout: 'random' }),
    'c0.5': A('mcts-puct', { cPuct: 0.5 }), 'c4': A('mcts-puct', { cPuct: 4 }), 'tau1': A('mcts-puct', { tau: 1 }), 'tau16': A('mcts-puct', { tau: 16 }), 'learned': A('mcts-learned'),
  };
  for (const [k, v] of Object.entries(mv)) all.push(...pairJobs(`M:${k}`, v, A('mcts-puct'), op16, 5000));
  // ---------------- 实验 S：算力缩放（与同一算法 200 ms 版本对弈）
  for (const t of [50, 100, 400, 800]) {
    all.push(...pairJobs(`S:ab@${t}`, A('ab', { timeMs: t }), A('ab'), op16, 7000));
    all.push(...pairJobs(`S:mcts@${t}`, A('mcts-puct', { timeMs: t }), A('mcts-puct'), op16, 7000));
  }
  // ---------------- 实验 X：相同预算下 α-β 对 MCTS
  for (const t of [50, 100, 200, 400, 800]) all.push(...pairJobs(`X:ab~mcts@${t}`, A('ab', { timeMs: t }), A('mcts-puct', { timeMs: t }), op16, 7500));
  save('main', all);
}

if (require.main === module && process.argv[2] === 'replicate') {
  // 重复实验：关键对比在同样 16 个开局上用 3 组新的随机种子各再下 32 局（α-β 是确定性的，但受计时影响；MCTS 受种子影响）
  const A = (agent, opts = {}) => ({ agent, opts: Object.assign({ timeMs: 200 }, opts) });
  const op16 = OP.slice(0, 16);
  const pairs = [['ab', 'mcts-puct'], ['mcts-learned', 'mcts-puct'], ['ab-tuned', 'ab'], ['mcts-puct', 'mcts-cutoff']];
  let all = [];
  for (let r = 1; r <= 3; r++) for (const [a, b] of pairs) all.push(...pairJobs(`R${r}:${a}~${b}`, A(a), A(b), op16, 20000 + r * 1000));
  save('replicate', all);
}
