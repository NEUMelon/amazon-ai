/*
 * worker.js — 在 Web Worker 中运行 AI 搜索，避免阻塞界面。
 * 打包时 build.js 会把引擎代码拼接在本文件之前，全局对象 AmazonsAI 可直接使用。
 * 消息协议：
 *   主线程 → worker: { type: 'think', id, moves: [着法字符串...], agent, opts }
 *   worker → 主线程: { type: 'progress', id, data } / { type: 'result', id, data } / { type: 'error', id, message }
 */
/* global AmazonsAI, POLICY_THETA, TUNED_WEIGHTS */
(function () {
  const G = AmazonsAI;
  if (typeof POLICY_THETA !== 'undefined' && POLICY_THETA) G.setPolicyTheta(POLICY_THETA);
  if (typeof TUNED_WEIGHTS !== 'undefined' && TUNED_WEIGHTS) G.setTunedWeights(TUNED_WEIGHTS);

  self.onmessage = function (ev) {
    const msg = ev.data;
    if (msg.type !== 'think') return;
    const id = msg.id;
    try {
      const b = G.Board.fromMoves(msg.moves);
      const opts = Object.assign({}, msg.opts || {});
      if (msg.agent.startsWith('ab')) opts.onIteration = it => self.postMessage({ type: 'progress', id, data: { kind: 'ab', iteration: it } });
      else if (msg.agent.startsWith('mcts')) opts.onProgress = rep => self.postMessage({ type: 'progress', id, data: Object.assign({ kind: 'mcts' }, rep) });
      const agent = G.makeAgent(msg.agent, opts);
      const t0 = Date.now();
      const r = agent.think(b);
      const out = {
        move: G.moveToStr(r.move), reason: r.reason, score: r.score, depth: r.depth, selDepth: r.selDepth, nodes: r.nodes,
        timeMs: r.timeMs, wallMs: Date.now() - t0, pv: r.pv, iterations: r.iterations, partialUsed: r.partialUsed,
        simulations: r.simulations, winrate: r.winrate, avgDepth: r.avgDepth, rootChildren: r.rootChildren,
        rootMoves: (r.rootMoves || []).map(x => Object.assign({}, x, { move: G.moveToStr(x.move) })),
      };
      self.postMessage({ type: 'result', id, data: out });
    } catch (e) {
      self.postMessage({ type: 'error', id, message: String(e && e.stack || e) });
    }
  };
})();
