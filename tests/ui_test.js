'use strict';
// 界面自动化测试（Playwright + Chromium，file:// 打开打包后的单文件网页）：node tests/ui_test.js
// 每个用例记录 通过/失败 与观测值，结果写入 data/ui_test.json；任何一个用例失败时进程以非 0 退出
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '../game/dist/amazons.html');
const results = [];
const errors = [];
function rec(id, name, ok, detail) { results.push({ id, name, ok: !!ok, detail }); console.log(ok ? 'PASS' : 'FAIL', id, name, '|', detail); }
const A = 'window.__amazons';
const hist = page => page.evaluate(() => window.__amazons.board.history.map(window.__amazons.G.moveToStr));
const len = page => page.evaluate(() => window.__amazons.board.history.length);
const setThink = (page, i) => page.$eval('#think', (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, String(i));
const idle = (page, n, t = 30000) => page.waitForFunction(k => window.__amazons.board.history.length >= k && !window.__amazons.busy, n, { timeout: t });
async function step(id, name, fn) {
  try { await fn(); } catch (e) { rec(id, name, false, 'exception: ' + String(e).split('\n')[0]); }
}
void A;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(URL); await page.waitForTimeout(500);
  const box = await page.locator('#board').boundingBox();
  const off = box.width * 0.06, cell = (box.width - 2 * off) / 10;
  // 用真实鼠标点击棋盘格子（坐标如 "d1"）
  const click = async sq => { const c = sq.charCodeAt(0) - 97, r = 10 - +sq.slice(1); await page.mouse.click(box.x + off + cell * (c + 0.5), box.y + off + cell * (r + 0.5)); await page.waitForTimeout(60); };
  const move = async s => { const [f, t, a] = s.split(/[-/]/); await click(f); await click(t); await click(a); };

  await step('U01', '页面加载与初始状态', async () => {
    const s = await page.evaluate(() => ({ n: window.__amazons.board.history.length, q: Array.from(window.__amazons.board.cells).filter(v => v === 1 || v === 2).length,
      opts: document.querySelectorAll('#aiWhite option').length, w: document.getElementById('board').width, worker: !!document.getElementById('workerSrc').textContent.length }));
    rec('U01', '页面加载与初始状态', s.n === 0 && s.q === 8 && s.opts >= 6 && s.w > 0 && s.worker && errors.length === 0, `初始局面 8 个后，${s.opts} 个可选 AI，画布宽 ${s.w}px，加载 ${Date.now() - t0} ms`);
  });
  await step('U02', '三次点击完成一步，AI 随后应着', async () => {
    await setThink(page, 0);
    const t = Date.now(); await move('d1-d7/g7'); await idle(page, 2, 10000);
    const h = await hist(page);
    rec('U02', '三次点击完成一步，AI 随后应着', h.length === 2 && h[0] === 'd1-d7/g7', `白 ${h[0]} → AI 应 ${h[1]}，用时 ${Date.now() - t} ms（含 250 ms 最短展示）`);
  });
  await step('U03', '非法点击被忽略或取消选择', async () => {
    const n0 = await len(page);
    await click('e5');                                       // 空格：不选中
    const s1 = await page.evaluate(() => window.__amazons.sel.from);
    const bq = await page.evaluate(() => window.__amazons.G.sqToStr(window.__amazons.board.queens[2][0]));
    await click(bq);                                         // 对方的后：不选中
    const s2 = await page.evaluate(() => window.__amazons.sel.from);
    await click('a4'); await click('j10');                   // 不可达的目的地：取消选择
    const s3 = await page.evaluate(() => window.__amazons.sel.from);
    rec('U03', '非法点击被忽略或取消选择', s1 < 0 && s2 < 0 && s3 < 0 && (await len(page)) === n0, `点空格→未选中；点黑后 ${bq}→未选中；a4 到 j10（不可达）→取消；手数保持 ${n0}`);
  });
  await step('U04', 'AI 思考期间点击棋盘无效', async () => {
    await setThink(page, 4);                                 // 2 s
    const legal = await page.evaluate(() => { const b = window.__amazons.board; return window.__amazons.G.moveToStr(b.genMoves()[0]); });
    await move(legal); await page.waitForTimeout(300);
    const busy = await page.evaluate(() => window.__amazons.busy);
    await click('a4'); await page.waitForTimeout(150);
    const sel = await page.evaluate(() => window.__amazons.sel.from);
    const n = await len(page);
    await idle(page, 4, 15000);
    rec('U04', 'AI 思考期间点击棋盘无效', busy && sel < 0 && n === 3 && (await len(page)) === 4, `思考中=${busy}，期间点击未产生选择，AI 落子后 ${await len(page)} 手`);
    await setThink(page, 0);
  });
  await step('U05', '搜索面板显示决策信息', async () => {
    const k = await page.evaluate(() => ['kAlgo', 'kDepth', 'kNodes', 'kTime', 'kReason', 'kPV'].map(id => document.getElementById(id).textContent.trim()));
    const rows = await page.$$eval('#searchTable tbody tr', r => r.length);
    rec('U05', '搜索面板显示决策信息', k.slice(0, 4).every(x => x && x !== '—') && rows >= 1, `算法=${k[0]}，深度/模拟=${k[1]}，结点/树深=${k[2]}，用时=${k[3]}，候选表 ${rows} 行`);
  });
  await step('U06', '悔棋退回到人类行棋', async () => {
    const before = await len(page); await page.click('#btnUndo'); await page.waitForTimeout(300);
    const after = await len(page); const side = await page.evaluate(() => window.__amazons.board.side);
    rec('U06', '悔棋退回到人类行棋', before - after === 2 && side === 1, `手数 ${before} → ${after}，轮到${side === 1 ? '白（人）' : '黑'}`);
  });
  await step('U07', 'Ctrl+Z 快捷键悔棋', async () => {
    const before = await len(page); await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    rec('U07', 'Ctrl+Z 快捷键悔棋', before - (await len(page)) === 2, `手数 ${before} → ${await len(page)}`);
  });
  await step('U08', '提示功能只推荐不落子', async () => {
    const before = await len(page);
    await page.click('#btnHint');
    await page.waitForFunction(() => !window.__amazons.busy && /提示/.test(document.getElementById('statusText').textContent), null, { timeout: 10000 });
    const st = await page.$eval('#statusText', e => e.textContent);
    rec('U08', '提示功能只推荐不落子', (await len(page)) === before, `状态栏「${st}」，手数保持 ${before}`);
  });
  await step('U09', '图层开关切换无错误', async () => {
    const e0 = errors.length;
    for (const id of ['lyTerr', 'lySearch', 'lyPV', 'lyDist', 'lyNum']) { await page.click('#' + id); await page.waitForTimeout(60); await page.click('#' + id); }
    rec('U09', '图层开关切换无错误', errors.length === e0, '5 个图层各切换 2 次');
  });
  // 在页面里用引擎生成一盘随机对局（固定种子），作为“导入棋谱”的测试数据
  const randomGame = await page.evaluate(() => { const G = window.__amazons.G, b = new G.Board(), r = G.mulberry32(99); while (!b.isOver()) b.play(b.randomMove(r)); return { moves: b.history.map(G.moveToStr), winner: b.winner }; });
  await step('U10', '导入完整棋谱并判定胜负', async () => {
    await page.click('button[data-tab="tRecord"]'); await page.waitForTimeout(200);
    await page.click('#btnImport'); await page.fill('#importBox', randomGame.moves.join(' ')); await page.click('#btnImport');
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => ({ over: window.__amazons.board.isOver(), w: window.__amazons.board.winner, modal: !document.getElementById('modal').hidden, t: document.getElementById('modalTitle').textContent }));
    rec('U10', '导入完整棋谱并判定胜负', s.over && s.w === randomGame.winner && s.modal, `导入 ${randomGame.moves.length} 手随机对局，弹窗「${s.t}」`);
    await page.click('#modalClose');
  });
  await step('U11', '非法棋谱给出提示', async () => {
    await page.click('#btnImport'); await page.fill('#importBox', 'd1-d7/g7 d1-d2/d3'); await page.click('#btnImport'); await page.waitForTimeout(300);
    const st = await page.$eval('#statusText', e => e.textContent);
    rec('U11', '非法棋谱给出提示', /有误/.test(st) && (await len(page)) === randomGame.moves.length, `状态栏「${st}」，原棋局保持 ${await len(page)} 手`);
    await page.evaluate(() => { document.getElementById('importBox').value = ''; document.getElementById('importBox').hidden = true; });
  });
  await step('U12', '导出棋谱为 JSON', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#btnExport')]);
    const p = await dl.path(); const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    rec('U12', '导出棋谱为 JSON', j.moves.length === randomGame.moves.length && j.result === (randomGame.winner === 1 ? 'white' : 'black'), `文件 ${dl.suggestedFilename()}，${j.moves.length} 手，结果 ${j.result}`);
  });
  await step('U13', '人执黑时 AI 先走', async () => {
    await page.selectOption('#mode', 'hb'); await page.click('#btnNew'); await idle(page, 1, 10000);
    const h = await hist(page);
    rec('U13', '人执黑时 AI 先走', h.length === 1, `AI 执白首着 ${h[0]}`);
  });
  await step('U14', '随机均衡开局', async () => {
    await page.selectOption('#mode', 'hh'); await page.selectOption('#opening', 'random'); await page.click('#btnNew'); await page.waitForTimeout(300);
    const h = await hist(page);
    rec('U14', '随机均衡开局', h.length === 2, `开局 ${h.join(' ')}`);
    await page.selectOption('#opening', 'empty');
  });
  await step('U15', '领地面板统计', async () => {
    await page.click('button[data-tab="tTerr"]'); await page.waitForTimeout(200);
    const t = await page.$eval('#terrStats', e => e.innerText.replace(/\s+/g, ' '));
    const rows = await page.$$eval('#terrStats table tbody tr', r => r.length);
    rec('U15', '领地面板统计', /白方领地/.test(t) && rows === 8, `显示双方领地格数与 8 个后的机动性：${t.slice(0, 60)}…`);
    await page.click('button[data-tab="tSearch"]');
  });
  await step('U16', '暂停与继续', async () => {
    await page.selectOption('#aiWhite', 'greedy'); await page.selectOption('#aiBlack', 'greedy');
    await page.selectOption('#mode', 'aa'); await page.click('#btnNew'); await idle(page, 3, 15000);
    await page.click('#btnPause'); const a = await len(page); await page.waitForTimeout(1500); const b = await len(page);
    await page.click('#btnPause'); await idle(page, b + 2, 15000); const c = await len(page);
    rec('U16', '暂停与继续', a === b && c >= b + 2, `暂停时 ${a} → 1.5 s 后 ${b}；继续后 ${c}`);
  });
  await step('U17', '对局中途切换模式与新局', async () => {
    await page.selectOption('#aiWhite', 'ab'); await page.selectOption('#aiBlack', 'ab'); await setThink(page, 4);
    await page.waitForFunction(() => window.__amazons.busy, null, { timeout: 10000 });
    await page.selectOption('#mode', 'hh'); await page.click('#btnNew'); await page.waitForTimeout(500);
    const s = await page.evaluate(() => ({ n: window.__amazons.board.history.length, busy: window.__amazons.busy }));
    rec('U17', '对局中途切换模式与新局', s.n === 0 && !s.busy, `搜索中切换到双人模式并新局：手数 ${s.n}，搜索已取消=${!s.busy}`);
    await setThink(page, 0);
  });
  // 每种 AI 在浏览器 Worker 中完整下一局（执白，对一步贪心，0.1 s/步）
  const ais = await page.$$eval('#aiWhite option', o => o.map(x => [x.value, x.textContent]));
  let k = 18;
  for (const [id, nm] of ais) {
    const tid = 'U' + String(k++).padStart(2, '0');
    await step(tid, `完整对局：${nm}`, async () => {
      await page.selectOption('#mode', 'hh');
      await page.selectOption('#aiWhite', id); await page.selectOption('#aiBlack', 'greedy');
      const e0 = errors.length, t = Date.now();
      await page.selectOption('#mode', 'aa'); await page.click('#btnNew');
      await page.waitForFunction(() => window.__amazons.board.isOver(), null, { timeout: 240000 });
      const s = await page.evaluate(() => ({ n: window.__amazons.board.history.length, w: window.__amazons.board.winner }));
      await page.waitForTimeout(500);
      const modal = await page.evaluate(() => !document.getElementById('modal').hidden);
      rec(tid, `完整对局：${nm}`, modal && errors.length === e0, `${s.n} 手，${s.w === 1 ? '白胜' : '黑胜'}，${((Date.now() - t) / 1000).toFixed(1)} s`);
      await page.click('#modalClose');
    });
  }
  await step('U' + k, '手机竖屏布局（390×844）', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    m.on('pageerror', e => errors.push(String(e)));
    await m.goto(URL); await m.waitForTimeout(400);
    const s = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.getElementById('board').getBoundingClientRect().width }));
    rec('U' + k, '手机竖屏布局（390×844）', s.sw <= 390 && s.bw >= 300, `页面宽 ${s.sw}px（无横向滚动），棋盘宽 ${Math.round(s.bw)}px`);
    await m.close();
  });
  k++;
  rec('U' + k, '全程无控制台错误', errors.length === 0, errors.length ? errors.slice(0, 3).join('; ') : `共 ${results.length} 个用例，0 个错误，总用时 ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await browser.close();
  fs.writeFileSync(path.join(__dirname, '../data/ui_test.json'), JSON.stringify({ results, errors, date: new Date().toISOString() }, null, 1));
  const fail = results.filter(r => !r.ok).length;
  console.log(`${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
})();
