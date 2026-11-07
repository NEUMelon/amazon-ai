"""第五章主实验与学习部分的图：python3 figs_results.py（读取 data/analysis.json、data/main.jsonl、models/*.json）"""
import json, os, collections
import numpy as np
from matplotlib.ticker import NullFormatter, NullLocator
from style import *
D = os.path.join(ROOT, 'data')
A = json.load(open(os.path.join(D, 'analysis.json')))
NAME = {'random': '随机', 'greedy': '一步贪心', 'ab': 'α-β（完整）', 'ab-tuned': 'α-β（Texel 权重）',
        'mcts-pure': 'MCTS（纯随机）', 'mcts-cutoff': 'MCTS（UCT+截断）', 'mcts-puct': 'MCTS（PUCT+可分离先验）', 'mcts-learned': 'MCTS（学习先验）'}
def fam(p): return C['ab'] if p.startswith('ab') else C['mcts'] if p.startswith('mcts') else C['base']

# ---- Elo
pool = A['pool']; elo = np.array(A['elo']); ci = np.array(A['elo_ci']); order = A['order']
fig, ax = plt.subplots(figsize=(6.4, 3.6))
for y, i in enumerate(order[::-1]):
    p = pool[i]; x = elo[i]
    ax.barh(y, x, color=fam(p), alpha=0.85, height=0.62)
    if p != 'greedy': ax.errorbar(x, y, xerr=[[max(0, x - ci[0, i])], [max(0, ci[1, i] - x)]], color='#111', capsize=2.5, lw=0.9)
    ax.text(x + (25 if x >= 0 else -25), y + 0.32, f'{elo[i]:+.0f}'.replace('-', '−'), va='center', ha='left' if x >= 0 else 'right', fontsize=7.5)
ax.set_yticks(range(len(order))); ax.set_yticklabels([NAME[pool[i]] for i in order[::-1]])
ax.axvline(0, color='#555', lw=0.8); ax.set_xlabel('Elo（以一步贪心为 0，误差线为 95% 自助区间）'); lo_, hi_ = min(ci[0].min(), elo.min()), max(ci[1].max(), elo.max()); ax.set_xlim(lo_ - 150, hi_ + 200)
save(fig, 'fig_elo')

# ---- 交叉胜率热力图
M = np.array(A['matrix'], dtype=float)
fig, ax = plt.subplots(figsize=(6.4, 5.2))
o = order; Mo = M[np.ix_(o, o)]
im = ax.imshow(Mo * 100, cmap='RdBu', vmin=0, vmax=100)
for i in range(len(o)):
    for j in range(len(o)):
        if i != j: ax.text(j, i, f'{Mo[i, j] * 100:.0f}', ha='center', va='center', fontsize=7, color='white' if abs(Mo[i, j] - 0.5) > 0.33 else '#111')
lab = [NAME[pool[i]] for i in o]
ax.set_xticks(range(len(o))); ax.set_xticklabels(lab, rotation=40, ha='right', fontsize=7.5); ax.set_yticks(range(len(o))); ax.set_yticklabels(lab, fontsize=7.5)
ax.grid(False); cb = fig.colorbar(im, ax=ax, shrink=0.8); cb.set_label('行智能体对列智能体的得分率 / %')
save(fig, 'fig_cross')

# ---- 消融森林图
def forest(rows, labels, name, base, h=None):
    n = len(rows)
    fig, ax = plt.subplots(figsize=(6.4, h or 0.32 * n + 0.9))
    for y, s in enumerate(rows[::-1]):
        col = C['learn'] if s['blo'] > 0.5 else C['red'] if s['bhi'] < 0.5 else C['base']
        ax.plot([s['wlo'] * 100, s['whi'] * 100], [y, y], color=col, lw=1, alpha=0.5)
        ax.plot([s['blo'] * 100, s['bhi'] * 100], [y, y], color=col, lw=3.2, alpha=0.75, solid_capstyle='butt')
        ax.plot(s['score'] * 100, y, 'o', color=col, ms=5)
        ax.text(101, y, f"{s['w']}–{s['l']}", va='center', fontsize=7)
    ax.axvline(50, color='#444', lw=0.8, ls='--')
    ax.set_yticks(range(n)); ax.set_yticklabels([labels(s['tag']) for s in rows[::-1]], fontsize=8)
    ax.set_xlim(0, 112); ax.set_xlabel(f'变体对{base}的得分率 / %（粗线：开局配对自助 95% 区间；细线：Wilson 区间）')
    save(fig, name)
import importlib.util, sys
sys.path.insert(0, os.path.join(ROOT, 'analysis'))
AB_LABEL = {'noTT': '无置换表', 'noKiller': '无杀手/历史启发', 'noPVS': '无 PVS', 'plain': '朴素 α-β（增强全关）', 'cheapOrder': '内部结点廉价排序',
            'sepLeaf': '叶前结点也用可分离排序', 'wide': '束宽加倍', 'narrow': '束宽减半', 'simpleEval': '只用 t1 领地项', 'noMob': '去掉移动性', 'noPhase': '去掉阶段插值'}
M_LABEL = {'uctSel': 'UCT 选择（无先验）', 'cheapOrder': '廉价分数排序/先验', 'randomOrder': '随机顺序+全部展开', 'noPW': '无渐进展开', 'cand10': '候选上限 10',
           'cand60': '候选上限 60', 'rollEval': '无模拟（直接评估）', 'cut2': '截断 2 步', 'cut8': '截断 8 步', 'rollRandom': '随机模拟到终局', 'c0.5': 'c_puct = 0.5',
           'c4': 'c_puct = 4', 'tau1': '先验温度 τ = 1', 'tau16': '先验温度 τ = 16', 'learned': '学习先验'}
forest(A['ab_abl'], lambda t: AB_LABEL[t[2:]], 'fig_ab_abl', '完整 α-β')
forest(A['mcts_abl'], lambda t: M_LABEL[t[2:]], 'fig_mcts_abl', ' MCTS-PUCT ')

# ---- 缩放
fig, axs = plt.subplots(1, 2, figsize=(6.6, 2.9))
ts = [50, 100, 200, 400, 800]
for key, col, lab in [('scale_ab', C['ab'], 'α-β（完整）'), ('scale_mcts', C['mcts'], 'MCTS-PUCT')]:
    rows = {int(s['tag'].split('@')[1]): s for s in A[key]}
    e = [rows[t]['elo'] if t != 200 else 0 for t in ts]
    lo = [rows[t]['elo_lo'] if t != 200 else 0 for t in ts]; hi = [rows[t]['elo_hi'] if t != 200 else 0 for t in ts]
    axs[0].plot(ts, e, 'o-', color=col, label=lab, lw=1.6, ms=4); axs[0].fill_between(ts, lo, hi, color=col, alpha=0.12, lw=0)
axs[0].set_xscale('log'); axs[0].xaxis.set_minor_locator(NullLocator()); axs[0].set_xticks(ts); axs[0].set_xticklabels(ts); axs[0].set_xlabel('每步思考时间 / ms'); axs[0].set_ylabel('相对自身 200 ms 的 Elo'); axs[0].legend()
axs[0].axhline(0, color='#666', lw=0.6)
rows = {int(s['tag'].split('@')[1]): s for s in A['cross_budget']}
axs[1].plot(ts, [rows[t]['score'] * 100 for t in ts], 'o-', color=C['purple'], lw=1.6, ms=4)
axs[1].fill_between(ts, [rows[t]['blo'] * 100 for t in ts], [rows[t]['bhi'] * 100 for t in ts], color=C['purple'], alpha=0.12, lw=0)
axs[1].set_xscale('log'); axs[1].xaxis.set_minor_locator(NullLocator()); axs[1].set_xticks(ts); axs[1].set_xticklabels(ts); axs[1].set_ylim(0, 100); axs[1].axhline(50, color='#666', lw=0.6, ls='--')
axs[1].set_xlabel('双方每步思考时间 / ms'); axs[1].set_ylabel('α-β 对 MCTS-PUCT 的得分率 / %')
fig.tight_layout(); save(fig, 'fig_scale')

# ---- 每步搜索量随时间预算
games = [json.loads(l) for l in open(os.path.join(D, 'raw', 'main.jsonl'))]
jobs = {j['id']: j for j in json.load(open(os.path.join(D, 'jobs', 'main.json')))}
dep = collections.defaultdict(list); sims = collections.defaultdict(list); used = collections.defaultdict(list)
for g in games:
    if not g['tag'].startswith(('S:', 'X:')): continue
    for e in g['log']:
        sp = jobs[g['id']]['white' if e['s'] == 1 else 'black']; t = sp['opts'].get('timeMs')
        if e['r'] not in ('search', 'mcts'): continue
        if sp['agent'] == 'ab': dep[t].append(e['d']); used[('ab', t)].append(e['ms'])
        else: sims[t].append(e['sims']); used[('mcts', t)].append(e['ms'])
fig, axs = plt.subplots(1, 3, figsize=(6.8, 2.6))
axs[0].boxplot([dep[t] for t in ts], positions=range(5), widths=0.55, showfliers=False, patch_artist=True, boxprops=dict(facecolor='#DCE6F1', color=C['ab']), medianprops=dict(color=C['ab']))
axs[0].plot(range(5), [np.mean(dep[t]) for t in ts], 'o', color=C['ab'], ms=3.5); axs[0].set_xticks(range(5)); axs[0].set_xticklabels(ts, fontsize=7); axs[0].set_title('α-β 完成深度', fontsize=9); axs[0].set_xlabel('ms')
axs[1].boxplot([sims[t] for t in ts], positions=range(5), widths=0.55, showfliers=False, patch_artist=True, boxprops=dict(facecolor='#F6E0D2', color=C['mcts']), medianprops=dict(color=C['mcts']))
axs[1].set_yscale('log'); axs[1].set_xticks(range(5)); axs[1].set_xticklabels(ts, fontsize=7); axs[1].set_title('MCTS 模拟次数', fontsize=9); axs[1].set_xlabel('ms')
for k, col in [('ab', C['ab']), ('mcts', C['mcts'])]:
    axs[2].plot(ts, [np.mean(used[(k, t)]) / t for t in ts], 'o-', color=col, ms=3.5, label='α-β' if k == 'ab' else 'MCTS')
    axs[2].plot(ts, [np.percentile(used[(k, t)], 99) / t for t in ts], 'x--', color=col, ms=3.5, lw=0.8)
axs[2].set_xscale('log'); axs[2].xaxis.set_minor_locator(NullLocator()); axs[2].set_xticks(ts); axs[2].set_xticklabels(ts, fontsize=7); axs[2].axhline(1, color='#666', lw=0.6); axs[2].set_title('实际用时 / 预算', fontsize=9); axs[2].legend(fontsize=7); axs[2].set_xlabel('ms')
fig.tight_layout(); save(fig, 'fig_budget')
json.dump({str(t): dict(depth=float(np.mean(dep[t])), sims=float(np.median(sims[t])), ab_used=float(np.mean(used[('ab', t)])), ab_p99=float(np.percentile(used[('ab', t)], 99)),
           mcts_used=float(np.mean(used[('mcts', t)])), mcts_p99=float(np.percentile(used[('mcts', t)], 99))) for t in ts}, open(os.path.join(D, 'budget_stats.json'), 'w'), indent=1)

# ---- 对局长度与先后手
L = A['lengths']
groups = [('循环赛', [x for t, v in L.items() if t.startswith('T:') for x in v]), ('α-β 消融', [x for t, v in L.items() if t.startswith('A:') for x in v]),
          ('MCTS 消融', [x for t, v in L.items() if t.startswith('M:') for x in v]), ('缩放', [x for t, v in L.items() if t.startswith('S:') for x in v]), ('同预算 α-β 对 MCTS', [x for t, v in L.items() if t.startswith('X:') for x in v])]
fig, axs = plt.subplots(1, 2, figsize=(6.6, 2.7))
axs[0].hist([g[1] for g in groups], bins=np.arange(30, 96, 3), stacked=True, color=SEQ[:5], label=[g[0] for g in groups], alpha=0.85)
axs[0].set_xlabel('对局总手数（含 2 手开局）'); axs[0].set_ylabel('局数'); axs[0].legend(fontsize=6.5)
bw = []
for name, pre in [('循环赛', 'T:'), ('α-β 消融', 'A:'), ('MCTS 消融', 'M:'), ('缩放', 'S:'), ('同预算', 'X:')]:
    gs = [g for g in games if g['tag'].startswith(pre)]
    bw.append((name, np.mean([g['winner'] == 1 for g in gs]), len(gs)))
axs[1].bar([b[0] for b in bw], [b[1] * 100 for b in bw], color=C['ink'], alpha=0.75, width=0.6)
for i, b in enumerate(bw): axs[1].text(i, b[1] * 100 + 1.5, f'{b[1] * 100:.0f}%', ha='center', fontsize=7.5)
axs[1].axhline(50, color='#666', lw=0.6, ls='--'); axs[1].set_ylabel('白方（先手）胜率 / %'); axs[1].set_ylim(0, 100); axs[1].tick_params(axis='x', labelsize=7.5)
fig.tight_layout(); save(fig, 'fig_lengths')

# ---- 学习：训练曲线、Top-k
P = json.load(open(os.path.join(ROOT, 'models', 'policy_weights.json')))['report']
cur = np.array(P['curve']); B = P['baselines']
fig, axs = plt.subplots(1, 2, figsize=(6.6, 2.7))
axs[0].plot(cur[:, 0], cur[:, 1], color=C['learn'], label='训练集'); axs[0].plot(cur[:, 0], cur[:, 2], color=C['learn'], ls='--', label='测试集')
axs[0].axhline(P['ablation']['sep_only']['test']['nll'], color=C['mcts'], lw=1, ls=':', label='只用可分离分数（学习温度）')
axs[0].axhline(B['uniform']['nll'], color=C['base'], lw=1, ls=':', label='均匀分布')
axs[0].set_xscale('log'); axs[0].set_xlabel('Adam 迭代步数（对数坐标）'); axs[0].set_ylabel('负对数似然 / nat'); axs[0].legend(fontsize=7)
ks = ['top1', 'top3', 'top5', 'top10']; x = np.arange(4); w = 0.26
axs[1].bar(x - w, [P['result']['test'][k] * 100 for k in ks], w, color=C['learn'], label='学习策略')
axs[1].bar(x, [B['sep_rank'][k] * 100 for k in ks], w, color=C['mcts'], label='可分离评估排序')
axs[1].bar(x + w, [100 * min(1, kk / P['mean_candidates']) for kk in (1, 3, 5, 10)], w, color=C['base'], label='随机（期望）')
axs[1].set_xticks(x); axs[1].set_xticklabels(['Top-1', 'Top-3', 'Top-5', 'Top-10']); axs[1].set_ylabel('测试集命中率 / %'); axs[1].legend(fontsize=7)
fig.tight_layout(); save(fig, 'fig_policy')

T = json.load(open(os.path.join(ROOT, 'models', 'eval_weights_tuned.json')))
R = T['report']
fig, axs = plt.subplots(1, 2, figsize=(6.6, 2.9))
ph = list(R['by_phase'].keys()); x = np.arange(len(ph))
axs[0].bar(x - 0.2, [R['by_phase'][k]['hand'] for k in ph], 0.4, color=C['ab'], label='手工权重')
axs[0].bar(x + 0.2, [R['by_phase'][k]['tuned'] for k in ph], 0.4, color=C['learn'], label='Texel 权重')
axs[0].axhline(R['baseline_ce'], color=C['base'], ls=':', lw=1, label='常数模型')
axs[0].set_xticks(x); axs[0].set_xticklabels([f"{k}\n(n={R['by_phase'][k]['n']})" for k in ph], fontsize=7); axs[0].set_xlabel('手数区间'); axs[0].set_ylabel('测试集交叉熵'); axs[0].legend(fontsize=7)
names = ['t1', 't2', 'c1', 'c2', 'mob']; wh, wt = R['weights_hand'], R['weights_tuned']; y = np.arange(5)
for j, (suf, lab) in enumerate([('_open', '开局'), ('_end', '后期')]):
    axs[1].barh(y + (j - 0.5) * 0.4 - 0.1, [wh[n + suf] for n in names], 0.18, color=C['ab'] if j == 0 else C['ab2'], label=f'手工·{lab}')
    axs[1].barh(y + (j - 0.5) * 0.4 + 0.1, [wt[n + suf] for n in names], 0.18, color=C['learn'] if j == 0 else '#8BC48E', label=f'Texel·{lab}')
axs[1].set_yticks(y); axs[1].set_yticklabels(names); axs[1].invert_yaxis(); axs[1].axvline(0, color='#555', lw=0.6); axs[1].set_xlabel('权重'); axs[1].legend(fontsize=6.5, ncol=2)
fig.tight_layout(); save(fig, 'fig_texel')
print('result figs done')
