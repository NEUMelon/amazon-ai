"""搜索效率、决策质量、随机性与浏览器速度的表与图：python3 analysis/efficiency_report.py
输入 data/efficiency.json、data/quality.json、data/quality_ref.json、data/variance.json、data/browser_bench.json（缺失的部分跳过）
输出 report/tables/eff_*.md、quality.md、variance.md、browser.md，report/figures/fig_eff.png、fig_quality.png，data/efficiency_summary.json"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'report', 'figscripts'))
from style import *
D = os.path.join(ROOT, 'data'); T = os.path.join(ROOT, 'report', 'tables')
os.makedirs(T, exist_ok=True)
E = json.load(open(os.path.join(D, 'efficiency.json')))
NAME = {'ab': 'α-β（完整）', 'ab-cheapOrder': 'α-β（廉价排序）', 'ab-tuned': 'α-β（Texel 权重）', 'mcts-pure': 'MCTS（纯随机）', 'mcts-uct': 'MCTS（UCT+截断，随机顺序）',
        'mcts-cutoff': 'MCTS（UCT+截断）', 'mcts-sep': 'MCTS（UCT+可分离排序）', 'mcts-puct': 'MCTS（PUCT+可分离先验）', 'mcts-learned': 'MCTS（学习先验）', 'greedy': '一步贪心'}
VN = {'full': '完整（PVS+置换表+杀手/历史）', 'noTT': '无置换表', 'noKiller': '无杀手/历史', 'noPVS': '无 PVS', 'plain': '朴素 α-β（增强全关）',
      'cheapOrder': '内部结点廉价排序', 'sepLeaf': '叶前结点也用可分离排序'}
gm = lambda xs: float(np.exp(np.mean(np.log(np.maximum(1e-9, xs))))) if len(xs) else float('nan')
summ = {}
phase = lambda ply: '开局（< 20 手）' if ply < 20 else '中局（20—39 手）' if ply < 40 else '后期（≥ 40 手）'
PH = ['开局（< 20 手）', '中局（20—39 手）', '后期（≥ 40 手）']

# ---- 表 1：着法排序质量（E1）
R1 = E['E1']
def rk(rows, key, k):
    v = [r[key] for r in rows if r[key] >= 0]
    return sum(1 for x in v if x < k) / len(rows)
L = ['| 局面组 | 局面数 | 平均合法着法数 | 静态最佳在廉价排序前 8 / 24 / 60 | 静态最佳在可分离排序前 1 / 8 / 30 | 逐一评估全部着法 / ms | 廉价排序 / ms | 可分离评估 / ms |', '|---|---|---|---|---|---|---|---|']
for name, rows in [(p, [r for r in R1 if phase(r['ply']) == p]) for p in PH] + [('全部', R1)]:
    if not rows: continue
    L.append(f"| {name} | {len(rows)} | {np.mean([r['n'] for r in rows]):.0f} | {rk(rows, 'rankCheap', 8) * 100:.0f}% / {rk(rows, 'rankCheap', 24) * 100:.0f}% / {rk(rows, 'rankCheap', 60) * 100:.0f}% | "
             f"{rk(rows, 'rankSep', 1) * 100:.0f}% / {rk(rows, 'rankSep', 8) * 100:.0f}% / {rk(rows, 'rankSep', 30) * 100:.0f}% | {np.mean([r['tFull'] for r in rows]):.1f} | {np.mean([r['tCheap'] for r in rows]):.2f} | {np.mean([r['tSep'] for r in rows]):.2f} |")
open(os.path.join(T, 'eff_order.md'), 'w').write('\n'.join(L) + '\n')
summ['order'] = dict(cheap8=rk(R1, 'rankCheap', 8), cheap24=rk(R1, 'rankCheap', 24), sep1=rk(R1, 'rankSep', 1), sep8=rk(R1, 'rankSep', 8), sep30=rk(R1, 'rankSep', 30),
                     tFull=float(np.mean([r['tFull'] for r in R1])), tCheap=float(np.mean([r['tCheap'] for r in R1])), tSep=float(np.mean([r['tSep'] for r in R1])), n=len(R1))

# ---- 表 2：固定深度 3 的 α-β（E2）
base = {i: r['nodes'] for i, r in enumerate(E['E2']['full'])}
bm = {i: r['move'] for i, r in enumerate(E['E2']['full'])}
L = ['| 变体 | 结点数（几何均值） | 相对完整版 | 平均用时 / ms | 首着截断率 | 置换表命中 / 内部结点 | 与完整版选择相同着法 |', '|---|---|---|---|---|---|---|']
summ['depth3'] = {}
for v, rows in E['E2'].items():
    nodes = [r['nodes'] for r in rows]; rel = gm([r['nodes'] / base[i] for i, r in enumerate(rows)])
    fc = sum(r['first'] for r in rows) / max(1, sum(r['cut'] for r in rows))
    tt = sum(r['tt'] for r in rows) / max(1, sum(r['interior'] for r in rows))
    same = np.mean([r['move'] == bm[i] for i, r in enumerate(rows)])
    summ['depth3'][v] = dict(gm_nodes=gm(nodes), rel=rel, ms=float(np.mean([r['ms'] for r in rows])), first=fc, tt=tt, same=float(same))
    L.append(f"| {VN[v]} | {gm(nodes):,.0f} | {rel:.2f}× | {np.mean([r['ms'] for r in rows]):,.0f} | {fc * 100:.1f}% | " + (f'{tt * 100:.1f}%' if sum(r['tt'] for r in rows) else '—') + f" | {same * 100:.0f}% |")
open(os.path.join(T, 'eff_depth3.md'), 'w').write('\n'.join(L) + '\n')

# ---- 表 3：200 ms 预算下的搜索量（E3）
L = ['| 智能体 | ' + ' | '.join(PH) + ' | 平均用时 / ms |', '|---|---|---|---|---|']
summ['budget'] = {}
for a, rows in E['E3'].items():
    cells = []; d = {}
    for p in PH:
        rr = [r for r in rows if phase(r['ply']) == p and r['reason'] in ('search', 'mcts')]
        if not rr: cells.append('—'); continue
        if a.startswith('ab'):
            v = np.mean([r['depth'] for r in rr]); nd = np.mean([r['nodes'] for r in rr]); cells.append(f'深度 {v:.2f}，{nd:,.0f} 结点'); d[p] = dict(depth=float(v), nodes=float(nd))
        else:
            v = np.mean([r['sims'] for r in rr]); dep = np.mean([r['selDepth'] for r in rr]); ch = np.mean([r['children'] for r in rr])
            cells.append(f'{v:,.0f} 次模拟，树深 {dep:.1f}，根子结点 {ch:.0f}'); d[p] = dict(sims=float(v), selDepth=float(dep), children=float(ch))
    summ['budget'][a] = d
    L.append(f"| {NAME.get(a, a)} | " + ' | '.join(cells) + f" | {np.mean([r['ms'] for r in rows]):.0f} |")
open(os.path.join(T, 'eff_budget.md'), 'w').write('\n'.join(L) + '\n')

# ---- 表 4：决策质量
qp = os.path.join(D, 'quality.json')
if os.path.exists(qp):
    Q = json.load(open(qp)); ref = json.load(open(os.path.join(D, 'quality_ref.json')))
    L = ['| 智能体（200 ms） | 与参考着法相同 | 平均遗憾值 / 格（截断到 ±10） | 遗憾值中位数 | 遗憾 ≥ 2 格的局面 | 遗憾 ≥ 5 格的局面 |', '|---|---|---|---|---|---|']
    summ['quality'] = {}
    order = sorted(Q, key=lambda a: np.mean([max(-10, min(r['regret'], 10)) for r in Q[a]]))
    for a in order:
        rows = Q[a]; rg = np.array([max(-10, min(r['regret'], 10)) for r in rows])     # 分隔计分（±200 量级）截到 ±10 格，避免个别局面主导均值
        summ['quality'][a] = dict(same=float(np.mean([r['same'] for r in rows])), mean=float(rg.mean()), median=float(np.median(rg)), ge2=float(np.mean(rg >= 2)), ge5=float(np.mean(rg >= 5)), n=len(rows))
        L.append(f"| {NAME.get(a, a)} | {np.mean([r['same'] for r in rows]) * 100:.0f}% | {rg.mean():.2f} | {np.median(rg):.2f} | {np.mean(rg >= 2) * 100:.0f}% | {np.mean(rg >= 5) * 100:.0f}% |")
    open(os.path.join(T, 'quality.md'), 'w').write('\n'.join(L) + '\n')
    summ['quality_ref'] = dict(depth=float(np.mean([r['depth'] for r in ref])), n=len(ref))
    fig, ax = plt.subplots(figsize=(6.4, 2.9))
    data = [np.clip([r['regret'] for r in Q[a]], -10, 10) for a in order]
    bp = ax.boxplot(data, vert=False, widths=0.55, showfliers=True, patch_artist=True, flierprops=dict(ms=2.5, alpha=0.5))
    for patch, a in zip(bp['boxes'], order): patch.set_facecolor('#DCE6F1' if a.startswith('ab') else '#F6E0D2' if a.startswith('mcts') else '#E5E7EB')
    ax.plot([np.mean(d) for d in data], range(1, len(order) + 1), 'D', color=C['ink'], ms=3.5, label='平均值')
    ax.set_yticks(range(1, len(order) + 1)); ax.set_yticklabels([NAME.get(a, a) for a in order], fontsize=7.5); ax.set_xlabel('遗憾值 / 格（截断到 ±10）'); ax.legend(fontsize=7)
    save(fig, 'fig_quality')

# ---- 表 5：随机性
vp = os.path.join(D, 'variance.json')
if os.path.exists(vp):
    V = json.load(open(vp))
    L = ['| 智能体（200 ms） | 5 次决策完全相同的局面 | 众数着法占比 | 每个局面的不同着法数（平均） |', '|---|---|---|---|']
    summ['variance'] = {}
    for a, rows in V.items():
        same = np.mean([r['distinct'] == 1 for r in rows]); mode = np.mean([r['modeShare'] for r in rows]); dist = np.mean([r['distinct'] for r in rows])
        summ['variance'][a] = dict(allSame=float(same), mode=float(mode), distinct=float(dist))
        L.append(f'| {NAME.get(a, a)} | {same * 100:.0f}% | {mode * 100:.0f}% | {dist:.2f} |')
    open(os.path.join(T, 'variance.md'), 'w').write('\n'.join(L) + '\n')

# ---- 表 6：浏览器与 Node
bp = os.path.join(D, 'browser_bench.json')
if os.path.exists(bp):
    B = json.load(open(bp)); summ['browser'] = B
    L = ['| 环境 | α-β 每秒结点（深度 3，20 个局面） | MCTS-PUCT 每秒模拟（1 s，10 个局面） |', '|---|---|---|',
         f'| Node.js {B["nodeVersion"]} | {B["node"]["nps"] / 1000:.1f} k | {B["node"]["simsPerSec"]:,.0f} |',
         f'| Chromium {B.get("chromiumVersion", "")}（页面主线程） | {B["chromium"]["nps"] / 1000:.1f} k | {B["chromium"]["simsPerSec"]:,.0f} |',
         f'| 比值（浏览器 / Node） | {B["chromium"]["nps"] / B["node"]["nps"]:.2f} | {B["chromium"]["simsPerSec"] / B["node"]["simsPerSec"]:.2f} |']
    open(os.path.join(T, 'browser.md'), 'w').write('\n'.join(L) + '\n')

# ---- 图：排序名次分布 + 深度 3 结点
fig, axs = plt.subplots(1, 2, figsize=(6.8, 2.8), gridspec_kw=dict(width_ratios=[1.1, 1]))
ks = np.arange(1, 61)
axs[0].plot(ks, [rk(R1, 'rankSep', k) * 100 for k in ks], color=C['ab'], lw=1.8, label='可分离评估')
axs[0].plot(ks, [rk(R1, 'rankCheap', k) * 100 for k in ks], color=C['mcts'], lw=1.8, label='廉价分数')
axs[0].set_xlabel('排序前 k 名'); axs[0].set_ylabel('包含静态最佳着法的局面 / %'); axs[0].set_ylim(0, 102); axs[0].legend(); axs[0].set_title('(a) 着法排序质量', fontsize=9)
vs = list(E['E2'].keys())
axs[1].barh(range(len(vs)), [summ['depth3'][v]['rel'] for v in vs], color=[C['ab'] if v == 'full' else C['ab2'] for v in vs])
for j, v in enumerate(vs): axs[1].text(summ['depth3'][v]['rel'] + 0.03, j, f"{summ['depth3'][v]['rel']:.2f}×", va='center', fontsize=7)
axs[1].set_yticks(range(len(vs))); axs[1].set_yticklabels([VN[v] for v in vs], fontsize=7); axs[1].invert_yaxis(); axs[1].axvline(1, color='#555', lw=0.6)
axs[1].set_xlabel('深度 3 结点数（相对完整版，几何均值）'); axs[1].set_title('(b) α-β 增强的效率作用', fontsize=9); axs[1].grid(axis='y', visible=False)
fig.tight_layout(); save(fig, 'fig_eff')
json.dump(summ, open(os.path.join(D, 'efficiency_summary.json'), 'w'), indent=1, ensure_ascii=False)
for f in ['eff_order', 'eff_depth3', 'eff_budget', 'quality', 'variance', 'browser']:
    p = os.path.join(T, f + '.md')
    if os.path.exists(p): print(f); print(open(p).read())
