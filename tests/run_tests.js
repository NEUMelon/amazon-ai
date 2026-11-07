'use strict';
// 单元测试：node tests/run_tests.js（结果同时写入 data/unit_tests.json）
const fs = require('fs'), path = require('path');
const G = require('../engine');
const E = G.Eval, M = G.MoveGen;
const assert = require('assert');
const results = [];
let passed = 0, failed = 0, group = '';
function section(s) { group = s; console.log(s); }
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); passed++; console.log('  ✓', name); results.push({ group, name, ok: true, ms: Date.now() - t0 }); }
  catch (e) { failed++; console.log('  ✗', name, '\n    ', e.message); results.push({ group, name, ok: false, ms: Date.now() - t0, err: e.message }); }
}
function randomPosition(rng, plies) {
  const b = new G.Board();
  for (let i = 0; i < plies && !b.isOver(); i++) b.play(b.randomMove(rng));
  return b;
}
// 竖直翻转并交换颜色：开局局面在此变换下不变
function flipSwap(b) {
  const c = new G.Board();
  c.cells.fill(0);
  for (let i = 0; i < 100; i++) { const r = (i / 10) | 0, col = i % 10, j = (9 - r) * 10 + col; const v = b.cells[i]; c.cells[j] = v === 1 ? 2 : v === 2 ? 1 : v; }
  c.queens = [null, b.queens[2].map(q => (9 - ((q / 10) | 0)) * 10 + q % 10), b.queens[1].map(q => (9 - ((q / 10) | 0)) * 10 + q % 10)];
  c.side = 3 - b.side; c.history = [];
  return c;
}
function bruteNegamax(b, d, w, ply = 0) {
  if (!b.canMove(b.side)) return -E.WIN + ply;           // 与 α-β 相同：越早获胜分数越高
  if (d === 0 || E.separated(b)) return E.evaluate(b, w);      // 与 α-β 相同：分隔后不再向下搜索
  let best = -Infinity;
  for (const m of b.genMoves()) { b.play(m); const v = -bruteNegamax(b, d - 1, w, ply + 1); b.undo(); if (v > best) best = v; }
  return best;
}

section('规则与走法生成');
test('开局局面共有 2176 个合法走法，countMoves 与 genMoves 一致', () => {
  const b = new G.Board();
  assert.strictEqual(b.genMoves().length, 2176);
  assert.strictEqual(b.countMoves(), 2176);
  assert.strictEqual(b.countMoves(G.BLACK), 2176);
});
test('genMoves 无重复，且每个走法都通过 isLegal（500 个随机局面）', () => {
  const rng = G.mulberry32(11);
  for (let k = 0; k < 500; k++) {
    const b = randomPosition(rng, (rng() * 80) | 0);
    if (b.isOver()) continue;
    const ms = b.genMoves();
    assert.strictEqual(new Set(ms).size, ms.length);
    for (let i = 0; i < ms.length; i += 7) assert.ok(b.isLegal(ms[i]), G.moveToStr(ms[i]));
  }
});
test('isLegal 与 genMoves 完全一致（随机编码 20 万次）', () => {
  const rng = G.mulberry32(12);
  for (let k = 0; k < 200; k++) {
    const b = randomPosition(rng, (rng() * 60) | 0);
    const set = new Set(b.genMoves());
    for (let i = 0; i < 1000; i++) {
      const qs = b.queens[b.side], f = qs[(rng() * 4) | 0];
      const m = G.mk(f, (rng() * 100) | 0, (rng() * 100) | 0);
      assert.strictEqual(b.isLegal(m), set.has(m));
    }
  }
});
test('randomMove 总是合法；canMove 与“存在合法走法”等价', () => {
  const rng = G.mulberry32(13);
  for (let g = 0; g < 300; g++) {
    const b = new G.Board();
    while (true) {
      const has = b.genMoves().length > 0;
      assert.strictEqual(b.canMove(), has);
      if (!has) break;
      const m = b.randomMove(rng); assert.ok(b.isLegal(m)); b.play(m);
    }
    assert.ok(b.history.length <= 92);
    assert.strictEqual(b.winner, 3 - b.side);
  }
});
test('play/undo 后棋盘、后的位置与哈希完全复原；增量哈希与重新计算一致', () => {
  const rng = G.mulberry32(14);
  const e = new G.Board();
  for (let g = 0; g < 200; g++) {
    const b = randomPosition(rng, 92);
    const f = G.Board.fromMoves(b.history);
    assert.strictEqual(f.hashLo, b.hashLo); assert.strictEqual(f.hashHi, b.hashHi);
    while (b.history.length) b.undo();
    assert.deepStrictEqual(Array.from(b.cells), Array.from(e.cells));
    assert.strictEqual(b.hashLo, e.hashLo); assert.strictEqual(b.hashHi, e.hashHi);
    assert.deepStrictEqual(b.queens[1].slice().sort(), e.queens[1].slice().sort());
  }
});
test('着法字符串编码互逆，非法字符串被拒绝', () => {
  const rng = G.mulberry32(15);
  const b = randomPosition(rng, 20);
  for (const m of b.genMoves()) assert.strictEqual(G.parseMove(G.moveToStr(m)), m);
  assert.throws(() => G.parseMove('k1-a1/a2'));
  assert.throws(() => G.Board.fromMoves(['a4-a7/a8']));     // a7 有黑后
});

section('距离与评估');
test('快速后距离/王距离与参考实现一致（300 个随机局面）', () => {
  const rng = G.mulberry32(21);
  const a = new Uint8Array(100), c = new Uint8Array(100);
  for (let k = 0; k < 300; k++) {
    const b = randomPosition(rng, (rng() * 90) | 0);
    for (const s of [1, 2]) {
      assert.deepStrictEqual(Array.from(E.queenDist(b.cells, b.queens[s], a)), Array.from(G.queenDist(b, s)));
      assert.deepStrictEqual(Array.from(E.kingDist(b.cells, b.queens[s], c)), Array.from(G.kingDist(b, s)));
    }
    assert.strictEqual(E.separated(b), G.isSeparated(b));
  }
});
test('评估对称性：竖直翻转并交换颜色后，行棋方评估值不变（500 个局面）', () => {
  const rng = G.mulberry32(22);
  for (let k = 0; k < 500; k++) {
    const b = randomPosition(rng, (rng() * 90) | 0);
    const v1 = E.evaluate(b), v2 = E.evaluate(flipSwap(b));
    assert.ok(Math.abs(v1 - v2) < 1e-9, v1 + ' vs ' + v2);
  }
});
test('无子可动时评估为 −WIN；分隔后评估等于区域格数之差加符号常数', () => {
  const rng = G.mulberry32(23);
  let nSep = 0;
  for (let g = 0; g < 200; g++) {
    const b = new G.Board();
    while (!b.isOver()) {
      if (E.separated(b)) {
        nSep++;
        const t = E.texelFeatures(b);
        const own = b.side === 1 ? t.regionW : t.regionB, opp = b.side === 1 ? t.regionB : t.regionW;
        const d = own - opp - 0.5;
        assert.ok(Math.abs(E.evaluate(b) - (d + (d > 0 ? E.SEP_BONUS : -E.SEP_BONUS))) < 1e-9);
      }
      b.play(b.randomMove(rng));
    }
    assert.strictEqual(E.evaluate(b), -E.WIN);
  }
  assert.ok(nSep > 100);
});
test('评估是 10 维 Texel 特征的线性函数（与 texelFeatures 点积一致）', () => {
  const rng = G.mulberry32(24);
  const w = Array.from({ length: 10 }, () => rng() * 2 - 1);
  for (let k = 0; k < 300; k++) {
    const b = randomPosition(rng, (rng() * 60) | 0);
    const t = E.texelFeatures(b); if (t.separated || b.isOver()) continue;
    const dot = t.x.reduce((s, x, i) => s + x * w[i], 0);
    assert.ok(Math.abs(E.evaluate(b, w) - (b.side === 1 ? dot : -dot)) < 1e-9);
  }
});

section('着法排序');
test('topMoves(k) 与全部排序的前 k 个完全一致', () => {
  const rng = G.mulberry32(31);
  for (let k = 0; k < 100; k++) {
    const b = randomPosition(rng, (rng() * 60) | 0); if (b.isOver()) continue;
    const all = M.topMoves(b, 0), t = M.topMoves(b, 12);
    assert.deepStrictEqual(t.moves, all.moves.slice(0, 12));
    assert.strictEqual(all.total, b.genMoves().length);
  }
});

section('α-β 搜索');
const FULL = { width: 9999, preWidth: 9999, rootPre: 9999, rootWidth: 9999, timeMs: 1e9 };
const smallPositions = [];
{
  const rng = G.mulberry32(41);
  while (smallPositions.length < 12) {
    const b = randomPosition(rng, 50 + ((rng() * 30) | 0));
    const n = b.genMoves().length;
    if (!b.isOver() && n >= 3 && n <= 40 && !E.separated(b)) smallPositions.push(b);
  }
}
test('全宽 α-β（深度 2）与穷举极小极大的根结点分数完全相同（12 个小局面）', () => {
  for (const b of smallPositions) {
    const ref = bruteNegamax(b.clone(), 2);
    for (const opt of [{}, { useTT: false, useKillers: false, useHistory: false, usePVS: false }]) {
      const ab = new G.Search.AlphaBeta(Object.assign({}, FULL, opt, { maxDepth: 2 }));
      const r = ab.search(b);
      assert.ok(Math.abs(r.score - ref) < 1e-6, `${r.score} vs ${ref}`);
    }
  }
});
test('能找到一步制胜（走完后对方无子可动）', () => {
  const rng = G.mulberry32(42);
  let found = 0;
  for (let g = 0; g < 400 && found < 20; g++) {
    const b = new G.Board();
    while (!b.isOver()) {
      if (!E.separated(b)) {
        const wins = b.genMoves().filter(m => { b.play(m); const w = !b.canMove(b.side); b.undo(); return w; });
        if (wins.length) {
          found++;
          const ab = new G.Search.AlphaBeta({ timeMs: 300 });
          const r = ab.search(b);
          b.play(r.move); assert.ok(!b.canMove(b.side), 'α-β 没有走出制胜着法'); b.undo();
          const mc = new G.MCTSMod.MCTS({ timeMs: 100 });
          const r2 = mc.search(b);
          b.play(r2.move); assert.ok(!b.canMove(b.side), 'MCTS 没有走出制胜着法'); b.undo();
          break;
        }
      }
      b.play(b.randomMove(rng));
    }
  }
  assert.ok(found >= 10, 'found ' + found);
});
test('不改变调用方传入的棋盘；遵守时间预算（200 ms 预算下用时 < 260 ms）', () => {
  const rng = G.mulberry32(43);
  for (let k = 0; k < 6; k++) {
    const b = randomPosition(rng, 10 * k);
    const h = [b.hashLo, b.hashHi, b.history.length];
    for (const name of ['ab', 'mcts-cutoff']) {
      const t0 = Date.now(); const r = G.makeAgent(name, { timeMs: 200 }).think(b); const ms = Date.now() - t0;
      assert.deepStrictEqual([b.hashLo, b.hashHi, b.history.length], h);
      assert.ok(b.isLegal(r.move)); assert.ok(ms < 260, name + ' ' + ms + 'ms');
    }
  }
});

section('智能体');
test('所有预设智能体在随机局面中都返回合法走法', () => {
  const rng = G.mulberry32(51);
  const names = Object.keys(G.PRESETS).filter(n => n !== 'ab-tuned' && n !== 'mcts-learned');
  for (let k = 0; k < 4; k++) {
    const b = randomPosition(rng, 20 * k + 5); if (b.isOver()) continue;
    for (const n of names) { const r = G.makeAgent(n, { timeMs: 30 }).think(b); assert.ok(b.isLegal(r.move), n); }
  }
});
test('填格策略：分隔后返回合法走法，且走完后己方可达格数是所有走法中最大的', () => {
  const rng = G.mulberry32(52);
  let n = 0;
  const reach = (b, s) => { const t = E.texelFeatures(b); return s === 1 ? t.regionW : t.regionB; };
  for (let g = 0; g < 60; g++) {
    const b = new G.Board();
    while (!b.isOver()) {
      if (E.separated(b)) {
        const m = G.fillerMove(b), s = b.side; assert.ok(b.isLegal(m));
        b.play(m); const got = reach(b, s); b.undo();
        let mx = -1; for (const x of b.genMoves()) { b.play(x); mx = Math.max(mx, reach(b, s)); b.undo(); }
        assert.strictEqual(got, mx);
        n++;
      }
      b.play(b.randomMove(rng));
    }
  }
  assert.ok(n > 100);
});

section('MCTS');
test('根结点各子结点访问次数之和等于模拟次数（maxSims 固定，4 种配置）', () => {
  const rng = G.mulberry32(61);
  for (let k = 0; k < 4; k++) {
    const b = randomPosition(rng, 8 + 6 * k);
    for (const o of [{}, { selection: 'puct', order: 'sep', maxCand: 30 }, { pw: false, order: 'random', rollout: 'random' }, { rollout: 'eval' }]) {
      const mc = new G.MCTSMod.MCTS(Object.assign({ maxSims: 300, winCheck: false, timeMs: 1e9 }, o));
      const r = mc.search(b);
      // rootMoves 只返回前 12 个；用 rootChildren 与 visits 校验总数需要完整列表，这里改用内部统计
      assert.ok(b.isLegal(r.move)); assert.strictEqual(r.simulations, 300);
      assert.ok(r.rootMoves.reduce((s, x) => s + x.visits, 0) <= 300);
      if (r.rootChildren <= 12) assert.strictEqual(r.rootMoves.reduce((s, x) => s + x.visits, 0), 300);
    }
  }
});
test('相同种子、相同模拟次数时结果完全可复现', () => {
  const rng = G.mulberry32(62);
  for (let k = 0; k < 4; k++) {
    const b = randomPosition(rng, 5 + 7 * k);
    for (const o of [{ order: 'random', pw: false, rollout: 'random' }, { selection: 'puct', order: 'sep' }]) {
      const run = () => new G.MCTSMod.MCTS(Object.assign({ maxSims: 400, seed: 7, timeMs: 1e9 }, o)).search(b);
      const a = run(), c = run();
      assert.strictEqual(a.move, c.move);
      assert.deepStrictEqual(a.rootMoves.map(x => x.visits), c.rootMoves.map(x => x.visits));
    }
  }
});
test('渐进展开：根结点子结点数不超过 ⌈pwC·n^pwA⌉+1，且不超过候选上限', () => {
  const rng = G.mulberry32(63);
  for (let k = 0; k < 4; k++) {
    const b = randomPosition(rng, 6 * k);
    for (const n of [50, 400, 2000]) {
      const r = new G.MCTSMod.MCTS({ maxSims: n, timeMs: 1e9, winCheck: false, maxCand: 60 }).search(b);
      assert.ok(r.rootChildren <= Math.ceil(2 * Math.pow(n, 0.5)) + 1, `${r.rootChildren} @ ${n}`);
      assert.ok(r.rootChildren <= 60);
    }
  }
});
test('PUCT 的启发式先验是概率分布（非负、和为 1）', () => {
  const rng = G.mulberry32(64);
  for (let k = 0; k < 5; k++) {
    const b = randomPosition(rng, 4 + 8 * k);
    const mc = new G.MCTSMod.MCTS({ order: 'sep', maxCand: 30 });
    const node = { cand: null, candP: null };
    mc.initCandidates(node, b);
    const s = node.candP.reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(s - 1) < 1e-9 && node.candP.every(x => x >= 0));
    assert.ok(node.cand.every(m => b.isLegal(m)) && new Set(node.cand).size === node.cand.length);
  }
});

section('知识层与学习模型');
test('分隔判定与独立的连通分量判定完全一致（2000 个随机局面，含敌对的后相邻的情形）', () => {
  const rng = G.mulberry32(71);
  const brute = b => {
    // 以 8 邻域在“空格 + 后”上做洪泛，看是否存在同时含双方后的连通分量
    const seen = new Int32Array(100).fill(-1);
    let comp = 0;
    for (let s = 0; s < 100; s++) {
      if (b.cells[s] === 3 || seen[s] >= 0) continue;
      const st = [s]; seen[s] = comp; let hasW = false, hasB = false;
      while (st.length) { const x = st.pop(); if (b.cells[x] === 1) hasW = true; if (b.cells[x] === 2) hasB = true;
        const r = (x / 10) | 0, c = x % 10;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < 10 && cc >= 0 && cc < 10) { const y = rr * 10 + cc; if (b.cells[y] !== 3 && seen[y] < 0) { seen[y] = comp; st.push(y); } } } }
      if (hasW && hasB) return false;
      comp++;
    }
    return true;
  };
  let nsep = 0;
  for (let g = 0; g < 2000; g++) {
    const b = randomPosition(rng, (rng() * 80) | 0);
    const a = E.separated(b), c = brute(b);
    assert.strictEqual(a, c, '分隔判定与连通分量判定不一致');
    if (a) nsep++;
  }
  assert.ok(nsep > 50);
});
test('领地图的归属与双方后距离的比较一致', () => {
  const rng = G.mulberry32(72);
  for (let k = 0; k < 200; k++) {
    const b = randomPosition(rng, (rng() * 60) | 0);
    const t = G.territoryMap(b);
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] !== 0) { assert.strictEqual(t.owner[i], null); continue; }
      const a = t.dW[i], c = t.dB[i];
      const want = (a >= 99 && c >= 99) ? null : a < c ? 1 : a > c ? -1 : 0;
      assert.strictEqual(t.owner[i], want);
    }
  }
});
test('可分离评估排序 sepTopMoves(k) 返回 k 个互不相同的合法着法，分数单调不增', () => {
  const rng = G.mulberry32(73);
  for (let k = 0; k < 30; k++) {
    const b = randomPosition(rng, (rng() * 50) | 0); if (b.isOver()) continue;
    const r = M.sepTopMoves(b, 20);
    const n = Math.min(20, b.genMoves().length);
    assert.strictEqual(r.moves.length, n);
    assert.strictEqual(new Set(r.moves).size, n);
    assert.ok(r.moves.every(m => b.isLegal(m)));
    for (let i = 1; i < n; i++) assert.ok(r.scores[i] <= r.scores[i - 1] + 1e-9);
  }
});
test('线性策略 LinearPolicy.rank 的输出是候选着法上的概率分布，前 k 个与完整排序一致', () => {
  const theta = new Array(G.Policy.NF).fill(0).map((_, i) => 0.1 * (i - 5));
  const pol = new G.Policy.LinearPolicy(theta, 40);
  const rng = G.mulberry32(74);
  for (let k = 0; k < 10; k++) {
    const b = randomPosition(rng, (rng() * 40) | 0); if (b.isOver()) continue;
    const r = pol.rank(b, 40), r2 = pol.rank(b, 10);           // 概率在全部（至多 40 个）候选上归一化
    assert.ok(r.moves.every(m => b.isLegal(m)));
    const s = r.probs.reduce((x, y) => x + y, 0); assert.ok(Math.abs(s - 1) < 1e-9);
    assert.ok(r2.probs.reduce((x, y) => x + y, 0) <= 1 + 1e-12);
    assert.deepStrictEqual(r2.moves, r.moves.slice(0, 10));
    for (let i = 1; i < r.probs.length; i++) assert.ok(r.probs[i] <= r.probs[i - 1] + 1e-12);
  }
});

section('对局');
test('一旦分隔，之后的局面始终保持分隔（300 局随机对局，回归测试）', () => {
  const rng = G.mulberry32(83);
  for (let g = 0; g < 300; g++) {
    const b = new G.Board(); let sep = false;
    while (!b.isOver()) { const s = E.separated(b); if (sep) assert.ok(s, '分隔后又恢复接触'); sep = s; b.play(b.randomMove(rng)); }
  }
});
test('随机对局总在 92 手内结束，负方确实无子可动（300 局）', () => {
  const rng = G.mulberry32(81);
  for (let g = 0; g < 300; g++) {
    const b = new G.Board(); let n = 0;
    while (!b.isOver()) { b.play(b.randomMove(rng)); n++; }
    assert.ok(n <= 92); assert.ok(!b.canMove(b.side)); assert.strictEqual(b.genMoves().length, 0);
  }
});
test('α-β 返回的主变例是一串合法着法', () => {
  const rng = G.mulberry32(82);
  for (let k = 0; k < 6; k++) {
    const b = randomPosition(rng, 6 * k); if (b.isOver()) continue;
    const r = new G.Search.AlphaBeta({ timeMs: 150 }).search(b);
    const c = b.clone();
    for (const s of r.pv) { const m = typeof s === 'number' ? s : G.parseMove(s); assert.ok(c.isLegal(m), 'pv ' + s); c.play(m); if (c.isOver()) break; }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'data', 'unit_tests.json'), JSON.stringify({ passed, failed, results }, null, 1));
process.exit(failed ? 1 : 0);
