"""
主实验统计分析：Elo（Bradley–Terry 最大后验）+ 自助法置信区间、各组胜率（Wilson 区间与按开局配对的自助区间）、
先后手、对局长度、每步搜索统计。所有表格以 Markdown 片段写入 report/tables/，数值写入 data/analysis.json。
    python3 analysis/analyze.py
"""
import json, math, os, re, collections
import numpy as np
from scipy.optimize import minimize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data'); TB = os.path.join(ROOT, 'report', 'tables')
os.makedirs(TB, exist_ok=True)
rng = np.random.default_rng(20261107)
games = [json.loads(l) for l in open(os.path.join(D, 'raw', 'main.jsonl'))]
jobs = {j['id']: j for j in json.load(open(os.path.join(D, 'jobs', 'main.json')))}
if len(games) != len(jobs): print('WARNING: incomplete', len(games), len(jobs))
games = [g for g in games if g['id'] in jobs]
NAME = {'random': '随机', 'greedy': '一步贪心', 'ab': 'α-β（完整）', 'ab-tuned': 'α-β（Texel 权重）',
        'mcts-pure': 'MCTS（纯随机）', 'mcts-cutoff': 'MCTS（UCT+评估截断）', 'mcts-puct': 'MCTS（PUCT+可分离先验）', 'mcts-learned': 'MCTS（学习先验）'}

def score_for_A(g):
    """以 tag 中第一个智能体（A）为视角的得分：胜 1、负 0（亚马逊棋没有和棋）。id 以 |AB 结尾表示 A 执白（先走）"""
    a_white = g['id'].endswith('|AB')
    return 1.0 if (g['winner'] == 1) == a_white else 0.0

def wilson(k, n, z=1.96):
    if n == 0: return (float('nan'),) * 2
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h

def elo_of(s):
    s = min(max(s, 1e-3), 1 - 1e-3)
    return -400 * math.log10(1 / s - 1)

def fmt_elo(x):
    if x >= 1199: return '≥+1200'
    if x <= -1199: return '≤−1200'
    return f'{x:+.0f}'.replace('-', '−')

by_tag = collections.defaultdict(list)
for g in games: by_tag[g['tag']].append(g)

def group_stats(tag):
    gs = by_tag[tag]
    sc = [score_for_A(g) for g in gs]
    n = len(sc); w = sum(1 for x in sc if x == 1); d = sum(1 for x in sc if x == 0.5); l = n - w - d
    s = sum(sc) / n
    lo, hi = wilson(w + d / 2, n)
    # 按开局配对的自助法：以开局为单位重采样
    pairs = collections.defaultdict(list)
    for g, x in zip(gs, sc): pairs[g['id'].split('|')[1]].append(x)
    pv = np.array([sum(v) / len(v) for v in pairs.values()])
    bs = rng.choice(pv, size=(4000, len(pv)), replace=True).mean(1)
    blo, bhi = np.percentile(bs, [2.5, 97.5])
    # 配对符号检验：每个开局 A 的两局得分和 >1 记 +，<1 记 −
    pos = sum(1 for v in pairs.values() if sum(v) > 1); neg = sum(1 for v in pairs.values() if sum(v) < 1)
    from scipy.stats import binomtest
    p_sign = binomtest(pos, pos + neg, 0.5).pvalue if pos + neg else 1.0
    white = sum(1 for g in gs if g['winner'] == 1) / n
    return dict(tag=tag, n=n, w=w, d=d, l=l, score=s, wlo=lo, whi=hi, blo=float(blo), bhi=float(bhi), elo=elo_of(s),
                elo_lo=elo_of(lo), elo_hi=elo_of(hi), pos=pos, neg=neg, p_sign=p_sign, white=white,
                length=float(np.mean([g['length'] for g in gs])))

# ---------------- 循环赛 Elo
pool = ['random', 'greedy', 'ab', 'ab-tuned', 'mcts-pure', 'mcts-cutoff', 'mcts-puct', 'mcts-learned']
idx = {p: i for i, p in enumerate(pool)}
T = [g for g in games if g['tag'].startswith('T:')]
def tri(g):
    a, b = g['tag'][2:].split('~')
    return idx[a], idx[b], score_for_A(g)
TR = [tri(g) for g in T]

def fit_elo(rows, prior_sd=600.0):
    k = len(pool)
    I = np.array([r[0] for r in rows]); J = np.array([r[1] for r in rows]); S = np.array([r[2] for r in rows])
    c = math.log(10) / 400
    def nll(r):
        d = (r[I] - r[J]) * c
        p = 1 / (1 + np.exp(-d))
        ll = S * np.log(p + 1e-12) + (1 - S) * np.log(1 - p + 1e-12)
        return -ll.sum() + ((r - r.mean()) ** 2).sum() / (2 * prior_sd ** 2) + 1e3 * r[idx['greedy']] ** 2
    def grad(r):
        d = (r[I] - r[J]) * c
        p = 1 / (1 + np.exp(-d))
        e = (S - p) * c
        gvec = np.zeros(k); np.add.at(gvec, I, -e); np.add.at(gvec, J, e)
        gvec += (r - r.mean()) / prior_sd ** 2
        gvec[idx['greedy']] += 2e3 * r[idx['greedy']]
        return gvec
    res = minimize(nll, np.zeros(k), jac=grad, method='L-BFGS-B')
    return res.x

elo = fit_elo(TR)
# 自助法：在每个配对组内按开局重采样
groups = collections.defaultdict(list)
for g, t in zip(T, TR): groups[(g['tag'], g['id'].split('|')[1])].append(t)
tags = collections.defaultdict(list)
for (tag, op), v in groups.items(): tags[tag].append(v)
B = 300
boot = []
for _ in range(B):
    rows = []
    for tag, ops in tags.items():
        for i in rng.integers(0, len(ops), len(ops)): rows += ops[i]
    boot.append(fit_elo(rows))
boot = np.array(boot)
elo_ci = np.percentile(boot, [2.5, 97.5], axis=0)
# 交叉表
mat = np.full((len(pool), len(pool)), np.nan)
for tag, gs in by_tag.items():
    if not tag.startswith('T:'): continue
    a, b = tag[2:].split('~'); s = np.mean([score_for_A(g) for g in gs])
    mat[idx[a], idx[b]] = s; mat[idx[b], idx[a]] = 1 - s
order = np.argsort(-elo)
out = dict(pool=pool, elo=elo.tolist(), elo_ci=elo_ci.tolist(), matrix=mat.tolist(), order=order.tolist())

lines = ['| 排名 | 智能体 | Elo（相对一步贪心） | 95% 自助区间 | 平均得分率 | 平均对局手数 |', '|---|---|---|---|---|---|']
for rk, i in enumerate(order, 1):
    p = pool[i]
    gs = [g for g in T if p in g['tag'][2:].split('~')]
    sc = np.mean([score_for_A(g) if g['tag'][2:].split('~')[0] == p else 1 - score_for_A(g) for g in gs])
    ln = np.mean([g['length'] for g in gs])
    lines.append(f'| {rk} | {NAME[p]} | {fmt_elo(elo[i])} | [{fmt_elo(elo_ci[0, i])}, {fmt_elo(elo_ci[1, i])}] | {sc * 100:.1f}% | {ln:.1f} |')
open(os.path.join(TB, 'elo.md'), 'w').write('\n'.join(lines) + '\n')
# 交叉胜率表
hdr = '| 行 \\ 列 | ' + ' | '.join(str(k + 1) for k in range(len(pool))) + ' |'
lines = [hdr, '|' + '---|' * (len(pool) + 1)]
for r, i in enumerate(order):
    cells = []
    for j in order:
        cells.append('—' if i == j else f'{mat[i, j] * 100:.0f}')
    lines.append(f'| {r + 1}. {NAME[pool[i]]} | ' + ' | '.join(cells) + ' |')
open(os.path.join(TB, 'cross.md'), 'w').write('\n'.join(lines) + '\n')

# ---------------- 消融与缩放
def table(tags, label_fn, fname, base_label):
    rows = []
    lines = [f'| 变体（对 {base_label}） | 胜–负 | 得分率 | Wilson 95% 区间 | 开局配对自助 95% 区间 | Elo 差 | 配对符号检验 p | 平均对局手数 |', '|---|---|---|---|---|---|---|---|']
    for t in tags:
        if not by_tag[t]: continue
        s = group_stats(t); rows.append(s)
        lines.append(f"| {label_fn(t)} | {s['w']}–{s['l']} | {s['score'] * 100:.1f}% | [{s['wlo'] * 100:.1f}, {s['whi'] * 100:.1f}] | [{s['blo'] * 100:.1f}, {s['bhi'] * 100:.1f}] | {fmt_elo(s['elo'])} | {s['p_sign']:.3f} | {s['length']:.1f} |")
    open(os.path.join(TB, fname), 'w').write('\n'.join(lines) + '\n')
    return rows

AB_LABEL = {'noTT': '无置换表', 'noKiller': '无杀手/历史启发', 'noPVS': '无 PVS（普通 α-β 窗口）', 'plain': '朴素 α-β（以上增强全部关闭）',
            'cheapOrder': '内部结点用廉价分数排序', 'sepLeaf': '叶前结点也用可分离评估排序', 'wide': '束宽加倍（16/48，根 120/60）',
            'narrow': '束宽减半（4/12，根 30/15）', 'simpleEval': '只用 t1 领地项的评估', 'noMob': '评估去掉移动性', 'noPhase': '评估去掉阶段插值（两组权重取平均）'}
M_LABEL = {'uctSel': 'UCT 选择（无先验，同样排序）', 'cheapOrder': '廉价分数排序与先验（上限 60）', 'randomOrder': '随机顺序、全部展开、UCT',
           'noPW': '无渐进展开', 'cand10': '候选上限 10', 'cand60': '候选上限 60', 'rollEval': '无模拟（直接评估）', 'cut2': '模拟截断 2 步',
           'cut8': '模拟截断 8 步', 'rollRandom': '随机模拟到终局', 'c0.5': 'c_puct = 0.5', 'c4': 'c_puct = 4', 'tau1': '先验温度 τ = 1',
           'tau16': '先验温度 τ = 16', 'learned': '学习先验'}
out['ab_abl'] = table([f'A:{k}' for k in AB_LABEL], lambda t: AB_LABEL[t[2:]], 'ab_ablation.md', '完整 α-β')
out['mcts_abl'] = table([f'M:{k}' for k in M_LABEL], lambda t: M_LABEL[t[2:]], 'mcts_ablation.md', 'MCTS-PUCT')
out['scale_ab'] = table([f'S:ab@{t}' for t in [50, 100, 400, 800]], lambda t: f"α-β {t.split('@')[1]} ms", 'scale_ab.md', 'α-β 200 ms')
out['scale_mcts'] = table([f'S:mcts@{t}' for t in [50, 100, 400, 800]], lambda t: f"MCTS {t.split('@')[1]} ms", 'scale_mcts.md', 'MCTS 200 ms')
out['cross_budget'] = table([f'X:ab~mcts@{t}' for t in [50, 100, 200, 400, 800]], lambda t: f"α-β 对 MCTS-PUCT，均 {t.split('@')[1]} ms", 'cross_budget.md', '同预算 MCTS-PUCT')

# ---------------- 先后手与对局长度
allg = games
ww = sum(1 for g in allg if g['winner'] == 1); bw = len(allg) - ww
out['colour'] = dict(white=ww, black=bw, n=len(allg))
near = [g for g in allg if g['tag'].startswith(('A:', 'M:', 'S:'))]
out['colour_near'] = dict(white=sum(1 for g in near if g['winner'] == 1), n=len(near))

# ---------------- 每步统计（只统计常规搜索着法：α-β 的 search 与 MCTS 的 mcts）
per = collections.defaultdict(lambda: collections.defaultdict(list))
reasons = collections.defaultdict(collections.Counter)
for g in allg:
    wht = jobs[g['id']]['white']; blk = jobs[g['id']]['black']
    for e in g['log']:
        spec = wht if e['s'] == 1 else blk
        key = spec['agent'] + ('' if spec['opts'].get('timeMs') == 200 and len(spec['opts']) == 1 else ' ' + json.dumps(spec['opts'], sort_keys=True))
        reasons[key][e['r']] += 1
        if e['r'] in ('search', 'mcts'):
            per[key]['ms'].append(e['ms'])
            if e.get('d') is not None: per[key]['d'].append(e['d']); per[key]['n'].append(e['n'])
            if e.get('sims') is not None: per[key]['sims'].append(e['sims']); per[key]['sd'].append(e.get('sd') or 0)
moves_stat = {}
for k, v in per.items():
    moves_stat[k] = {kk: dict(mean=float(np.mean(vv)), median=float(np.median(vv)), p90=float(np.percentile(vv, 90)), max=float(np.max(vv)), n=len(vv)) for kk, vv in v.items() if vv}
out['moves'] = moves_stat
out['reasons'] = {k: dict(v) for k, v in reasons.items()}
allms = [e['ms'] for g in allg for e in g['log'] if e['r'] in ('search', 'mcts')]
out['time_all'] = dict(n=len(allms), max=float(max(allms)), p999=float(np.percentile(allms, 99.9)))
lines = ['| 智能体（200 ms/步） | 搜索着法数 | 平均用时/ms | 最长用时/ms | 平均完成深度 | 结点数中位数 | 模拟次数中位数 | 平均最大树深 | 填格着法比例 |', '|---|---|---|---|---|---|---|---|---|']
for p in pool[2:]:
    if p not in moves_stat: continue
    m = moves_stat[p]; rc = reasons[p]; tot = sum(rc.values())
    g = lambda kk, f='{:.1f}': f.format(m[kk]['mean']) if kk in m else '—'
    gm = lambda kk: f"{m[kk]['median']:.0f}（{m[kk]['p90']:.0f}）" if kk in m else '—'
    lines.append(f"| {NAME[p]} | {m['ms']['n']} | {g('ms')} | {m['ms']['max']:.0f} | {g('d', '{:.2f}')} | {gm('n')} | {gm('sims')} | {g('sd', '{:.1f}')} | {rc.get('filler', 0) / tot * 100:.1f}% |")
open(os.path.join(TB, 'move_stats.md'), 'w').write('\n'.join(lines) + '\n')
out['lengths'] = {t: [g['length'] for g in gs] for t, gs in by_tag.items()}
json.dump(out, open(os.path.join(D, 'analysis.json'), 'w'), ensure_ascii=False, default=float)
print('Elo:'); [print(f'  {pool[i]:13s} {elo[i]:+7.0f} [{elo_ci[0, i]:+.0f},{elo_ci[1, i]:+.0f}]') for i in order]
for k in ['ab_abl', 'mcts_abl', 'scale_ab', 'scale_mcts', 'cross_budget']:
    print(k); [print(f"  {s['tag']:18s} {s['w']:2d}-{s['d']}-{s['l']:2d} {s['score'] * 100:5.1f}% elo {s['elo']:+5.0f} p={s['p_sign']:.3f}") for s in out[k]]
print('colour', out['colour'], out['colour_near'], out['time_all'])
