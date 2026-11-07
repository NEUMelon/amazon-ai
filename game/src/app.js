/*
 * app.js — 亚马逊棋 AI 实验台的界面逻辑
 * 引擎（AmazonsAI）在主线程中只用于规则判定与领地计算，搜索在 Web Worker 中执行。
 * 走一步分三次点击：选择己方的后 → 选择目的地 → 选择射箭位置。
 */
/* global AmazonsAI, POLICY_THETA, TUNED_WEIGHTS, OPENINGS, AI_LIST_CFG, WIN_K */
(function () {
  'use strict';
  const G = AmazonsAI;
  const N = G.N;
  const $ = id => document.getElementById(id);
  const hasPolicy = typeof POLICY_THETA !== 'undefined' && POLICY_THETA;
  const hasTuned = typeof TUNED_WEIGHTS !== 'undefined' && TUNED_WEIGHTS;
  if (hasPolicy) G.setPolicyTheta(POLICY_THETA);
  if (hasTuned) G.setTunedWeights(TUNED_WEIGHTS);
  const K = typeof WIN_K !== 'undefined' && WIN_K ? WIN_K : 0.15;   // 评估值 → 胜率 的换算系数

  // ---------------------------------------------------------------- 配置
  const AI_LIST = (typeof AI_LIST_CFG !== 'undefined' ? AI_LIST_CFG : [
    { id: 'ab', name: 'α-β 搜索（最强）', short: 'α-β' },
    { id: 'mcts-puct', name: 'MCTS · PUCT + 评估截断', short: 'MCTS-PUCT' },
    { id: 'mcts-cutoff', name: 'MCTS · UCT + 评估截断', short: 'MCTS-截断' },
    { id: 'mcts-pure', name: 'MCTS · 纯随机模拟', short: 'MCTS-纯随机' },
    { id: 'greedy', name: '贪心 · 一步评估', short: '贪心' },
    { id: 'random', name: '随机走子', short: '随机' },
  ]).filter(a => (!a.needPolicy || hasPolicy) && (!a.needTuned || hasTuned));
  const THINK_STEPS = [100, 250, 500, 1000, 2000, 3000, 5000];
  const MODE_DESC = { hw: ['玩家', 'AI'], hb: ['AI', '玩家'], aa: ['AI', 'AI'], hh: ['玩家', '玩家'] };

  // ---------------------------------------------------------------- 状态
  let board = new G.Board();
  let evalHist = [0.5];         // evalHist[k] = 第 k 手后白方胜率估计（null 表示无）
  let result = null;            // 最近一次搜索结果 { key, side, agent, data }
  let live = null;              // 搜索进行中的中间结果
  let hint = null;              // 提示着法（字符串）
  let sel = { from: -1, to: -1 };   // 人类走子的中间状态
  let legal = null;             // 当前局面全部合法走法（整数）
  let worker = null, jobId = 0, busy = false, paused = false, gameOverShown = false;

  // ---------------------------------------------------------------- Worker
  function makeWorker() {
    if (worker) worker.terminate();
    const src = $('workerSrc').textContent;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = onWorkerMsg;
    worker.onerror = e => { setStatus('Worker 出错：' + e.message, false); busy = false; };
  }
  function cancelSearch() {
    if (busy) { makeWorker(); busy = false; }
    live = null; showThinking(false);
  }
  function posKey(b) { return b.history.join(','); }

  function requestSearch(purpose) {
    const side = board.side;
    const agent = side === G.WHITE ? $('aiWhite').value : $('aiBlack').value;
    const timeMs = THINK_STEPS[+$('think').value];
    const id = ++jobId;
    busy = true; live = null;
    showThinking(true, purpose === 'hint' ? '正在为你分析…' : `${aiName(agent)} 思考中…`);
    setStatus(purpose === 'hint' ? '分析中' : 'AI 思考中', true);
    worker.postMessage({ type: 'think', id, moves: board.history.map(G.moveToStr), agent, opts: { timeMs, seed: 1 + board.history.length } });
    worker.pending = { id, purpose, key: posKey(board), side, agent, t0: performance.now() };
  }

  function onWorkerMsg(ev) {
    const msg = ev.data, p = worker.pending;
    if (!p || msg.id !== p.id) return;
    if (msg.type === 'progress') {
      live = { key: p.key, side: p.side, agent: p.agent, data: msg.data };
      renderSearchPanel(live, true);
      draw();
      return;
    }
    busy = false; showThinking(false);
    if (msg.type === 'error') { setStatus('搜索出错', false); console.error(msg.message); return; }
    const data = msg.data;
    result = { key: p.key, side: p.side, agent: p.agent, data };
    live = null;
    renderSearchPanel(result, false);
    if (p.key !== posKey(board)) { draw(); return; }
    if (p.purpose === 'hint') { hint = data.move; setStatus('提示：' + data.move, false); draw(); return; }
    setStatus('准备就绪', false);
    const wr = winrateWhite(result);
    const wait = Math.max(0, 250 - (performance.now() - p.t0));   // 至少展示 250 ms 的思考过程
    setTimeout(() => { if (p.key === posKey(board)) playMove(G.parseMove(data.move), wr); }, wait);
  }

  // ---------------------------------------------------------------- 规则与流程
  function isAI(side) {
    const m = $('mode').value;
    if (m === 'aa') return true;
    if (m === 'hw') return side === G.BLACK;
    if (m === 'hb') return side === G.WHITE;
    return false;
  }
  function playMove(m, wr = null) {
    if (board.isOver() || !board.isLegal(m)) return;
    board.play(m);
    hint = null; sel = { from: -1, to: -1 };
    const k = board.history.length;
    evalHist.length = k;
    evalHist[k] = wr != null ? wr : (k > 0 ? evalHist[k - 1] ?? 0.5 : 0.5);
    afterMove();
  }
  function afterMove() {
    legal = board.isOver() ? [] : board.genMoves();
    draw(); renderRecord(); renderPlayers(); drawCurve(); renderTerritory();
    $('moveNo').textContent = board.history.length;
    if (board.isOver()) { onGameOver(); return; }
    maybeAI();
  }
  function maybeAI() {
    if (board.isOver() || busy || paused) return;
    if (isAI(board.side)) {
      const delay = $('mode').value === 'aa' ? 200 : 0;
      setTimeout(() => { if (!busy && !paused && isAI(board.side) && !board.isOver()) requestSearch('move'); }, delay);
    }
  }
  function onGameOver() {
    if (gameOverShown) return;
    gameOverShown = true;
    const w = board.winner, who = w === G.WHITE ? '白方' : '黑方', loser = w === G.WHITE ? '黑方' : '白方';
    const ctrl = isAI(w) ? aiName(w === G.WHITE ? $('aiWhite').value : $('aiBlack').value) : '玩家';
    $('modalTitle').textContent = `${who}获胜`;
    $('modalText').textContent = `第 ${board.history.length} 手后，${loser}的四个后都已无路可走，${who}（${ctrl}）获胜。`;
    setTimeout(() => { $('modal').hidden = false; }, 350);
    setStatus(`${who}获胜`, false);
  }
  function newGame() {
    cancelSearch();
    board = new G.Board(); evalHist = [0.5]; result = null; hint = null; gameOverShown = false; paused = false; sel = { from: -1, to: -1 };
    $('btnPause').textContent = '暂 停';
    $('modal').hidden = true;
    if ($('opening').value === 'random' && typeof OPENINGS !== 'undefined') {
      const op = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
      for (const s of op) { board.play(G.parseMove(s)); evalHist.push(0.5); }
    }
    renderSearchPanel(null); afterMove();
  }
  function undo() {
    cancelSearch();
    if (!board.history.length) return;
    const m = $('mode').value;
    let n = 1;
    if ((m === 'hw' || m === 'hb') && board.history.length >= 2) n = isAI(board.side) ? 1 : 2;   // 退回到玩家行棋
    for (let i = 0; i < n && board.history.length; i++) board.undo();
    evalHist.length = board.history.length + 1;
    gameOverShown = false; result = null; hint = null; sel = { from: -1, to: -1 }; $('modal').hidden = true;
    if (m === 'aa') { paused = true; $('btnPause').textContent = '继 续'; }
    afterMove();
  }

  // ---------------------------------------------------------------- 胜率换算（白方视角）
  function winrateWhite(res) {
    if (!res) return null;
    const d = res.data;
    let w = null;
    if (d.reason === 'win') w = 1;
    else if (d.winrate != null) w = d.winrate;
    else if (d.score != null) {
      if (d.score > G.Search.WIN_BOUND) w = 1; else if (d.score < -G.Search.WIN_BOUND) w = 0;
      else w = 1 / (1 + Math.exp(-K * d.score));
    }
    if (w == null) return null;
    return res.side === G.WHITE ? w : 1 - w;
  }

  // ---------------------------------------------------------------- 绘制棋盘
  const cv = $('board'), ctx = cv.getContext('2d');
  let geo = null;
  function resize() {
    const wrap = $('boardWrap');
    const size = Math.floor(wrap.clientWidth);
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const off = size * 0.06, cell = (size - 2 * off) / N;
    geo = { size, cell, off };
    draw();
  }
  const X = c => geo.off + c * geo.cell;          // 格子左上角
  const Y = r => geo.off + r * geo.cell;
  const CX = i => X(i % N) + geo.cell / 2, CY = i => Y((i / N) | 0) + geo.cell / 2;

  function draw() {
    if (!geo) return;
    const { size, cell, off } = geo;
    ctx.fillStyle = '#2b3440'; ctx.fillRect(0, 0, size, size);
    const key = posKey(board);
    const terr = $('lyTerr').checked ? G.territoryMap(board) : null;
    for (let i = 0; i < N * N; i++) {
      const r = (i / N) | 0, c = i % N;
      ctx.fillStyle = (r + c) % 2 ? '#e2d3b3' : '#f1e8d4';
      ctx.fillRect(X(c), Y(r), cell, cell);
      if (terr && board.cells[i] === G.EMPTY && terr.owner[i] !== null) {
        const o = terr.owner[i];
        ctx.fillStyle = o === 1 ? 'rgba(66,133,244,.32)' : o === -1 ? 'rgba(219,68,55,.30)' : 'rgba(120,120,120,.16)';
        ctx.fillRect(X(c), Y(r), cell, cell);
      }
    }
    // 坐标
    ctx.fillStyle = '#d7dde5'; ctx.font = `${Math.max(10, cell * 0.28)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      ctx.fillText('abcdefghij'[i], X(i) + cell / 2, size - off / 2);
      ctx.fillText('abcdefghij'[i], X(i) + cell / 2, off / 2);
      ctx.fillText(String(N - i), off / 2, Y(i) + cell / 2);
      ctx.fillText(String(N - i), size - off / 2, Y(i) + cell / 2);
    }
    // 上一手
    const lm = board.lastMove();
    if (lm >= 0) {
      for (const [sq, col] of [[G.mFrom(lm), 'rgba(255,214,0,.35)'], [G.mTo(lm), 'rgba(255,214,0,.55)']]) { ctx.fillStyle = col; ctx.fillRect(X(sq % N), Y((sq / N) | 0), cell, cell); }
    }
    // 当前局面的搜索结果；若没有，则显示“上一手 AI 着法”所依据的搜索结果
    let cur = live && live.key === key ? live : (result && result.key === key ? result : null);
    let shift = 0;
    if (!cur && result && board.history.length && result.key === board.history.slice(0, -1).join(',') && result.data.move === G.moveToStr(lm)) { cur = result; shift = 1; }
    if ($('lySearch').checked && cur && !shift && !board.isOver()) drawSearch(cur);
    // 箭与后
    const showNum = $('lyNum').checked;
    const arrowNo = new Map(); board.history.forEach((m, k) => arrowNo.set(G.mArrow(m), k + 1));
    for (let i = 0; i < N * N; i++) {
      const v = board.cells[i];
      if (v === G.ARROW) drawArrowCell(i, showNum ? arrowNo.get(i) : null, lm >= 0 && G.mArrow(lm) === i);
      else if (v === G.WHITE || v === G.BLACK) drawQueen(i, v, 1);
    }
    if (terr && $('lyDist').checked) drawDist(terr);
    if ($('lyPV').checked && cur && !board.isOver()) drawPV(cur, shift);
    if (hint) drawMoveArrow(G.parseMove(hint), '#1f4e79', 3, true);
    drawSelection();
  }

  function drawQueen(i, side, alpha) {
    const x = CX(i), y = CY(i), rad = geo.cell * 0.38;
    ctx.save(); ctx.globalAlpha = alpha;
    if (alpha === 1) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = rad * 0.35; ctx.shadowOffsetY = rad * 0.1; }
    const gr = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    if (side === G.BLACK) { gr.addColorStop(0, '#6a6a6a'); gr.addColorStop(1, '#0b0b0b'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfcfcf'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = side === G.BLACK ? '#f2d16b' : '#7a5a10';
    ctx.font = `${geo.cell * 0.46}px "Segoe UI Symbol", "Noto Sans Symbols2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♛', x, y + geo.cell * 0.02);
    ctx.restore();
  }
  function drawArrowCell(i, num, last) {
    const x = X(i % N), y = Y((i / N) | 0), c = geo.cell, p = c * 0.12;
    ctx.fillStyle = last ? '#8e3b2c' : '#5d4a36'; ctx.fillRect(x + p, y + p, c - 2 * p, c - 2 * p);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    if (num != null) {
      ctx.fillStyle = '#fff'; ctx.font = `600 ${c * 0.3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(num), x + c / 2, y + c / 2 + 1);
    } else {
      const q = c * 0.3;
      ctx.beginPath(); ctx.moveTo(x + q, y + q); ctx.lineTo(x + c - q, y + c - q); ctx.moveTo(x + c - q, y + q); ctx.lineTo(x + q, y + c - q); ctx.stroke();
    }
  }
  // 用带箭头的线段画一个走法：后 from → to，再从 to 射箭到 arrow（虚线）
  function drawMoveArrow(m, color, width, dashedArrow, label) {
    const f = G.mFrom(m), t = G.mTo(m), a = G.mArrow(m);
    const line = (p, q, dash) => {
      const x1 = CX(p), y1 = CY(p), x2 = CX(q), y2 = CY(q);
      ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash([width * 2, width * 1.6]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      const ang = Math.atan2(y2 - y1, x2 - x1), h = width * 3.2;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - h * Math.cos(ang - 0.45), y2 - h * Math.sin(ang - 0.45)); ctx.lineTo(x2 - h * Math.cos(ang + 0.45), y2 - h * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    line(f, t, false);
    line(t, a, dashedArrow);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; const s = geo.cell * 0.22;
    ctx.beginPath(); ctx.moveTo(CX(a) - s, CY(a) - s); ctx.lineTo(CX(a) + s, CY(a) + s); ctx.moveTo(CX(a) + s, CY(a) - s); ctx.lineTo(CX(a) - s, CY(a) + s); ctx.stroke();
    ctx.restore();
    if (label != null) {
      ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(CX(t) + geo.cell * 0.3, CY(t) - geo.cell * 0.3, geo.cell * 0.17, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${geo.cell * 0.2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(label), CX(t) + geo.cell * 0.3, CY(t) - geo.cell * 0.3 + 1); ctx.restore();
    }
  }
  function drawSearch(cur) {
    const d = cur.data;
    const list = (d.rootMoves || []).slice(0, 5);
    if (!list.length && d.kind === 'ab' && d.iteration) { drawMoveArrow(G.parseMove(d.iteration.move), 'rgba(192,57,43,.85)', 3, true); return; }
    if (!list.length && d.kind === 'mcts' && d.best) { drawMoveArrow(G.parseMove(d.best), 'rgba(192,57,43,.85)', 3, true); return; }
    for (let k = list.length - 1; k >= 0; k--) {
      const m = G.parseMove(list[k].move);
      drawMoveArrow(m, k === 0 ? 'rgba(192,57,43,.9)' : `rgba(31,78,121,${0.75 - k * 0.12})`, k === 0 ? 3.2 : 2, true, k + 1);
    }
  }
  function drawPV(cur, shift = 0) {
    const d = cur.data;
    const pv = (d.pv || (d.iteration && d.iteration.pv) || []).slice(shift + (d.rootMoves && d.rootMoves.length && !shift ? 1 : 0), shift + 4);
    if (!pv.length) return;
    // 在一个副本上依次走主变例，用半透明画出后续各手（编号从 2 开始，因为第 1 手已由“搜索结果”层画出）
    const b = board.clone(); let start = shift + (d.rootMoves && d.rootMoves.length && !shift ? 1 : 0);
    if (shift === 0 && start === 1) { const first = (d.pv || [])[0]; if (!first) return; const m0 = G.parseMove(first); if (!b.isLegal(m0)) return; b.play(m0); }
    pv.forEach((s, k) => {
      const m = G.parseMove(s); if (!b.isLegal(m)) return;
      drawMoveArrow(m, b.side === G.WHITE ? 'rgba(255,255,255,.85)' : 'rgba(20,20,20,.75)', 2, true, k + 1 + start);
      b.play(m);
    });
  }
  function drawDist(terr) {
    ctx.font = `600 ${geo.cell * 0.2}px sans-serif`; ctx.textBaseline = 'middle';
    for (let i = 0; i < N * N; i++) {
      if (board.cells[i] !== G.EMPTY) continue;
      const a = terr.dW[i], c = terr.dB[i];
      ctx.textAlign = 'left'; ctx.fillStyle = '#1a4fa0'; ctx.fillText(a >= G.INF ? '∞' : String(a), X(i % N) + geo.cell * 0.08, Y((i / N) | 0) + geo.cell * 0.2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#a3261b'; ctx.fillText(c >= G.INF ? '∞' : String(c), X(i % N) + geo.cell * 0.92, Y((i / N) | 0) + geo.cell * 0.8);
    }
  }
  function drawSelection() {
    if (sel.from < 0) return;
    const c = geo.cell;
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 3; ctx.strokeRect(X(sel.from % N) + 2, Y((sel.from / N) | 0) + 2, c - 4, c - 4);
    const dots = new Set();
    for (const m of legal) {
      if (G.mFrom(m) !== sel.from) continue;
      if (sel.to < 0) dots.add(G.mTo(m)); else if (G.mTo(m) === sel.to) dots.add(G.mArrow(m));
    }
    if (sel.to >= 0) {
      ctx.fillStyle = (Math.floor(sel.from / N) + sel.from % N) % 2 ? '#e2d3b3' : '#f1e8d4';
      ctx.fillRect(X(sel.from % N), Y((sel.from / N) | 0), c, c);
      drawQueen(sel.to, board.side, 0.85);
      ctx.strokeStyle = '#ffb300'; ctx.strokeRect(X(sel.to % N) + 2, Y((sel.to / N) | 0) + 2, c - 4, c - 4);
    }
    for (const d of dots) {
      ctx.fillStyle = sel.to < 0 ? 'rgba(46,125,50,.75)' : 'rgba(192,57,43,.8)';
      ctx.beginPath(); ctx.arc(CX(d), CY(d), c * 0.13, 0, 7); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- 面板
  function aiName(id) { const a = AI_LIST.find(x => x.id === id); return a ? a.short : id; }
  function fmtScore(v, short) {
    if (v == null) return '—';
    if (v > G.Search.WIN_BOUND) return short ? '胜' : '必胜';
    if (v < -G.Search.WIN_BOUND) return short ? '负' : '必败';
    return (v > 0 ? '+' : '') + v.toFixed(short ? 1 : 2);
  }
  function fmtNum(n) { if (n == null) return '—'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); }
  const REASONS = {
    search: '迭代加深 α-β 搜索：按搜索值选择着法。箭头为根结点得分最高的 5 个候选（虚线为射箭方向）。',
    mcts: '蒙特卡洛树搜索：选择访问次数最多的子结点。箭头为访问次数最多的 5 个候选。',
    win: '一步制胜：走完后对方四个后都无路可走。', random: '随机走子。', greedy: '一步贪心：选择走完后静态评估最高的走法。',
    filler: '双方已完全分隔：进入填格阶段，使用共用的填格策略（尽量保留己方可走的格子）。', fallback: '时间太短，按启发式排序走第一步。',
  };

  function renderSearchPanel(cur, isLive) {
    const thead = $('searchTable').querySelector('thead'), tbody = $('searchTable').querySelector('tbody');
    if (!cur) {
      ['kAlgo', 'kDepth', 'kNodes', 'kNps', 'kTime', 'kEval'].forEach(k => $(k).textContent = '—');
      $('kReason').textContent = '尚未开始搜索。'; $('kReason').className = 'reason'; $('kPV').textContent = '—';
      thead.innerHTML = ''; tbody.innerHTML = ''; return;
    }
    const d = cur.data;
    $('kAlgo').textContent = aiName(cur.agent);
    if (d.kind === 'ab' && d.iteration) {
      const it = d.iteration;
      $('kDepth').textContent = `${it.depth} 层`; $('kNodes').textContent = fmtNum(it.nodes);
      $('kNps').textContent = fmtNum(Math.round(it.nodes / Math.max(1, it.ms) * 1000)) + '/s';
      $('kTime').textContent = it.ms + ' ms'; $('kEval').textContent = fmtScore(it.score);
      $('kPV').textContent = (it.pv || []).join('  ');
      $('kReason').textContent = `迭代加深进行中：第 ${it.depth} 层完成，当前最佳 ${it.move}。`; $('kReason').className = 'reason';
      appendIterRow(it);
      return;
    }
    if (d.kind === 'mcts' || d.simulations != null) {
      $('kDepth').textContent = `${fmtNum(d.simulations)} 次`;
      $('kNodes').textContent = `树深 ${d.selDepth ?? d.maxDepth ?? '—'}`;
      const ms = d.timeMs ?? d.ms;
      $('kNps').textContent = ms ? fmtNum(Math.round(d.simulations / ms * 1000)) + ' 次/s' : '—';
      $('kTime').textContent = (ms ?? 0) + ' ms';
      $('kEval').textContent = d.winrate != null ? (d.winrate * 100).toFixed(1) + '%' : '—';
      $('kPV').textContent = (d.pv || []).join('  ') || (d.best || '—');
      $('kReason').textContent = isLive ? `模拟进行中：已完成 ${d.simulations} 次模拟，当前最佳 ${d.best}。` : (REASONS[d.reason] || d.reason);
      $('kReason').className = 'reason' + (d.reason === 'win' ? ' win' : '');
      if (!isLive) {
        thead.innerHTML = '<tr><th>#</th><th>着法</th><th>访问 N</th><th>胜率 Q</th><th>先验 P</th><th></th></tr>';
        const rm = d.rootMoves || [], maxN = Math.max(1, ...rm.map(c => c.visits));
        tbody.innerHTML = rm.map((c, k) => `<tr><td>${k + 1}</td><td>${c.move}</td><td>${c.visits}</td><td>${(c.winrate * 100).toFixed(1)}%</td><td>${c.prior != null ? (c.prior * 100).toFixed(1) + '%' : '—'}</td><td><span class="bar" style="width:${Math.round(50 * c.visits / maxN)}px"></span></td></tr>`).join('');
      }
      return;
    }
    $('kDepth').textContent = d.depth != null ? `${d.depth} 层` : '1 层';
    $('kNodes').textContent = fmtNum(d.nodes);
    $('kNps').textContent = d.nodes && d.timeMs ? fmtNum(Math.round(d.nodes / Math.max(1, d.timeMs) * 1000)) + '/s' : '—';
    $('kTime').textContent = (d.timeMs ?? 0) + ' ms';
    $('kEval').textContent = fmtScore(d.score);
    $('kPV').textContent = (d.pv || []).join('  ') || '—';
    let reason = REASONS[d.reason] || d.reason;
    if (d.partialUsed) reason += ' 最后一层未搜完，采用了该层已搜完部分中的最佳着法。';
    $('kReason').textContent = reason;
    $('kReason').className = 'reason' + (d.score > G.Search.WIN_BOUND ? ' win' : '');
    if (d.rootMoves && d.rootMoves.length) {
      const its = (d.iterations || []).map(it => `${it.depth}层:${it.move}(${fmtScore(it.score, true)})`).join(' → ');
      thead.innerHTML = '<tr><th>#</th><th>候选着法</th><th>搜索值</th><th></th></tr>';
      const mx = Math.max(...d.rootMoves.map(r => r.score)), mn = Math.min(...d.rootMoves.map(r => r.score));
      tbody.innerHTML = d.rootMoves.map((r, k) => `<tr><td>${k + 1}</td><td>${r.move}</td><td>${fmtScore(r.score, true)}</td><td><span class="bar" style="width:${Math.round(6 + 44 * (mx > mn ? (r.score - mn) / (mx - mn) : 1))}px"></span></td></tr>`).join('') +
        (its ? `<tr><td colspan="4" class="iters">迭代过程：${its}</td></tr>` : '');
    } else { thead.innerHTML = ''; tbody.innerHTML = ''; }
  }
  function appendIterRow(it) {
    const thead = $('searchTable').querySelector('thead'), tbody = $('searchTable').querySelector('tbody');
    if (it.depth === 1 || !thead.innerHTML.includes('深度')) { thead.innerHTML = '<tr><th>深度</th><th>最佳</th><th>评估</th><th>结点</th><th>用时</th></tr>'; tbody.innerHTML = ''; }
    tbody.insertAdjacentHTML('beforeend', `<tr><td>${it.depth}</td><td>${it.move}</td><td>${fmtScore(it.score, true)}</td><td>${fmtNum(it.nodes)}</td><td>${it.ms} ms</td></tr>`);
  }

  function renderPlayers() {
    const m = $('mode').value;
    const [wn, bn] = MODE_DESC[m];
    $('nameWhite').textContent = wn === 'AI' ? aiName($('aiWhite').value) : '玩家';
    $('nameBlack').textContent = bn === 'AI' ? aiName($('aiBlack').value) : '玩家';
    $('plWhite').classList.toggle('turn', !board.isOver() && board.side === G.WHITE);
    $('plBlack').classList.toggle('turn', !board.isOver() && board.side === G.BLACK);
    $('aiWhite').disabled = !isAI(G.WHITE) && m !== 'hh';
    $('aiBlack').disabled = !isAI(G.BLACK) && m !== 'hh';
    $('btnPause').disabled = m !== 'aa';
  }
  function renderRecord() {
    const ol = $('record');
    ol.innerHTML = board.history.map((m, i) => `<li class="${i % 2 ? 'b' : 'w'}${i === board.history.length - 1 ? ' cur' : ''}">${G.moveToStr(m)}</li>`).join('');
    ol.scrollTop = ol.scrollHeight;
  }
  function renderTerritory() {
    const t = G.territoryMap(board), f = G.Eval.texelFeatures(board);
    let w = 0, b = 0, eq = 0, none = 0;
    for (let i = 0; i < N * N; i++) { const o = t.owner[i]; if (board.cells[i] !== G.EMPTY) continue; if (o === 1) w++; else if (o === -1) b++; else if (o === 0) eq++; else none++; }
    const mob = s => board.queens[s].map(q => G.Eval.queenMobility(board.cells, q));
    const mw = mob(G.WHITE), mb = mob(G.BLACK);
    const sep = G.Eval.separated(board);
    $('terrStats').innerHTML = `
      <div class="kpis">
        <div><small>白方领地（后距离更近）</small><b style="color:#2a62c9">${w} 格</b></div>
        <div><small>黑方领地</small><b style="color:#b8372a">${b} 格</b></div>
        <div><small>均势 / 无人可达</small><b>${eq} / ${none}</b></div>
        <div><small>剩余空格</small><b>${100 - 8 - board.history.length}</b></div>
        <div><small>阶段系数 p</small><b>${f.p.toFixed(2)}</b></div>
        <div><small>局面状态</small><b>${board.isOver() ? '已结束' : sep ? '已分隔' : '争夺中'}</b></div>
      </div>
      <table class="mob"><thead><tr><th>后</th><th>位置</th><th>一步可达格数</th></tr></thead><tbody>
      ${board.queens[G.WHITE].map((q, k) => `<tr><td>白 ${k + 1}</td><td>${G.sqToStr(q)}</td><td>${mw[k]}${mw[k] === 0 ? '（被困）' : ''}</td></tr>`).join('')}
      ${board.queens[G.BLACK].map((q, k) => `<tr><td>黑 ${k + 1}</td><td>${G.sqToStr(q)}</td><td>${mb[k]}${mb[k] === 0 ? '（被困）' : ''}</td></tr>`).join('')}
      </tbody></table>`;
  }

  // ---------------------------------------------------------------- 胜率曲线
  function drawCurve() {
    const c = $('curve'), x = c.getContext('2d');
    const w = c.clientWidth || 360, h = 190, dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const L = 36, R = 10, T = 10, B = 24;
    const n = Math.max(10, board.history.length);
    const px = k => L + (w - L - R) * k / n, py = v => T + (h - T - B) * (1 - v);
    x.strokeStyle = '#e5e0d5'; x.fillStyle = '#6b7280'; x.font = '11px sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) { x.beginPath(); x.moveTo(L, py(v)); x.lineTo(w - R, py(v)); x.stroke(); x.fillText(Math.round(v * 100) + '%', L - 4, py(v)); }
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (let k = 0; k <= n; k += Math.ceil(n / 8)) x.fillText(String(k), px(k), h - B + 6);
    x.strokeStyle = '#1f4e79'; x.lineWidth = 2; x.beginPath();
    let started = false;
    for (let k = 0; k <= board.history.length; k++) {
      const v = evalHist[k]; if (v == null) continue;
      if (!started) { x.moveTo(px(k), py(v)); started = true; } else x.lineTo(px(k), py(v));
    }
    x.stroke();
    x.fillStyle = 'rgba(66,133,244,.07)'; x.fillRect(L, T, w - L - R, (h - T - B) / 2);
  }

  // ---------------------------------------------------------------- 交互
  function setStatus(text, isBusy) { $('statusText').textContent = text; $('status').classList.toggle('busy', !!isBusy); }
  function showThinking(on, text) { $('thinking').hidden = !on; if (text) $('thinkingText').textContent = text; }

  function clickCell(i) {
    if (board.isOver() || isAI(board.side)) return;
    if (busy && worker.pending && worker.pending.purpose !== 'hint') return;
    const v = board.cells[i];
    if (sel.from < 0 || (sel.to < 0 && v === board.side)) {
      if (v === board.side && legal.some(m => G.mFrom(m) === i)) { sel = { from: i, to: -1 }; setStatus('选择目的地', false); }
      draw(); return;
    }
    if (sel.to < 0) {
      if (legal.some(m => G.mFrom(m) === sel.from && G.mTo(m) === i)) { sel.to = i; setStatus('选择射箭位置', false); }
      else sel = { from: -1, to: -1 };
      draw(); return;
    }
    const m = G.mk(sel.from, sel.to, i);
    if (board.isLegal(m)) { cancelSearch(); setStatus('准备就绪', false); playMove(m); }
    else { sel = { from: -1, to: -1 }; draw(); }
  }
  cv.addEventListener('click', ev => {
    if (!geo) return;
    const rect = cv.getBoundingClientRect();
    const c = Math.floor((ev.clientX - rect.left - geo.off) / geo.cell), r = Math.floor((ev.clientY - rect.top - geo.off) / geo.cell);
    if (r < 0 || r >= N || c < 0 || c >= N) { sel = { from: -1, to: -1 }; draw(); return; }
    clickCell(r * N + c);
  });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); sel = { from: -1, to: -1 }; draw(); });

  function fillAISelect(s, def) { s.innerHTML = AI_LIST.map(a => `<option value="${a.id}">${a.name}</option>`).join(''); s.value = def; }
  fillAISelect($('aiWhite'), AI_LIST[0].id);
  fillAISelect($('aiBlack'), AI_LIST[1] ? AI_LIST[1].id : AI_LIST[0].id);
  const syncThink = () => { const v = THINK_STEPS[+$('think').value]; $('thinkOut').textContent = (v / 1000).toFixed(v < 1000 ? 2 : 1) + ' 秒'; };
  $('think').addEventListener('input', syncThink); syncThink();
  $('mode').addEventListener('change', () => { cancelSearch(); paused = false; $('btnPause').textContent = '暂 停'; sel = { from: -1, to: -1 }; renderPlayers(); draw(); maybeAI(); });
  ['aiWhite', 'aiBlack'].forEach(id => $(id).addEventListener('change', renderPlayers));
  ['lyTerr', 'lySearch', 'lyPV', 'lyDist', 'lyNum'].forEach(id => $(id).addEventListener('change', draw));
  $('btnNew').addEventListener('click', newGame);
  $('modalNew').addEventListener('click', newGame);
  $('modalClose').addEventListener('click', () => { $('modal').hidden = true; });
  $('btnUndo').addEventListener('click', undo);
  $('btnHint').addEventListener('click', () => { if (!board.isOver() && !busy) requestSearch('hint'); });
  $('btnPause').addEventListener('click', () => {
    paused = !paused; $('btnPause').textContent = paused ? '继 续' : '暂 停';
    if (paused) cancelSearch(); else maybeAI();
  });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('active', p.id === t.dataset.tab));
    if (t.dataset.tab === 'tCurve') drawCurve();
  }));
  $('btnExport').addEventListener('click', () => {
    const rec = { format: 'amazons-ai-lab/1', board: '10x10', date: new Date().toISOString(),
      white: $('nameWhite').textContent, black: $('nameBlack').textContent,
      result: board.isOver() ? (board.winner === G.WHITE ? 'white' : 'black') : 'unfinished',
      moves: board.history.map(G.moveToStr) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' }));
    a.download = `amazons_${Date.now()}.json`; a.click();
  });
  $('btnImport').addEventListener('click', () => {
    const box = $('importBox');
    if (box.hidden) { box.hidden = false; box.focus(); return; }
    const txt = box.value.trim();
    if (!txt) { box.hidden = true; return; }
    let moves;
    try { moves = JSON.parse(txt).moves; } catch (e) { moves = txt.split(/[\s,，]+/).filter(Boolean); }
    try {
      cancelSearch();
      const b = G.Board.fromMoves(moves);
      board = b; evalHist = new Array(b.history.length + 1).fill(null); evalHist[0] = 0.5;
      result = null; gameOverShown = false; box.hidden = true; box.value = ''; sel = { from: -1, to: -1 };
      $('mode').value = 'hh'; paused = false; afterMove();
      setStatus(`已导入 ${moves.length} 手`, false);
    } catch (e) { setStatus('棋谱格式有误：' + e.message, false); }
  });
  $('btnCopy').addEventListener('click', () => {
    const s = board.history.map(G.moveToStr).join(' ');
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(() => setStatus('已复制棋谱', false), () => setStatus('复制失败', false));
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'Escape') { sel = { from: -1, to: -1 }; draw(); }
  });
  window.addEventListener('resize', () => { resize(); drawCurve(); });

  // 供自动化测试使用的只读接口
  window.__amazons = { get board() { return board; }, get busy() { return busy; }, get result() { return result; }, get sel() { return sel; }, G, playMove: s => playMove(G.parseMove(s)), clickCell, newGame };

  makeWorker();
  resize();
  newGame();
})();
