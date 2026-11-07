"""第一章基础图：规则示意、分支因子。  python3 figs_basic.py"""
import json, os
import numpy as np
from style import *

# ---------- 1. 规则示意：初始局面与一步着法
fig, axs = plt.subplots(1, 2, figsize=(6.8, 3.5))
draw_board(axs[0], [], title='(a) 初始局面（白方先走）')
draw_board(axs[1], ['d1-d7/g7'], arrows=[('d1-d7/g7', C['red'], None)], last=False, title='(b) 白方 d1-d7/g7：后走到 d7，再向 g7 射箭')
fig.tight_layout(); save(fig, 'fig_rules')

# ---------- 2. 分支因子
B = json.load(open(os.path.join(ROOT, 'data', 'branching.json')))
rows = np.array(B['rows'])
fig, ax = plt.subplots(figsize=(6.4, 3.0))
ks = np.arange(0, 92)
med, lo, hi, n = [], [], [], []
for k in ks:
    s = rows[rows[:, 0] == k][:, 1]
    n.append(len(s))
    if len(s) >= 5: med.append(np.median(s)); lo.append(np.percentile(s, 10)); hi.append(np.percentile(s, 90))
    else: med.append(np.nan); lo.append(np.nan); hi.append(np.nan)
ax2 = ax.twinx(); ax2.bar(ks, n, color=C['base'], alpha=0.18, width=0.8); ax2.set_ylabel('局面数', color=C['base']); ax2.grid(False)
ax2.spines['right'].set_visible(True); ax.set_zorder(ax2.get_zorder() + 1); ax.patch.set_visible(False)
ax.plot(ks, med, color=C['ab'], lw=1.8, label='合法着法数（中位数）'); ax.fill_between(ks, lo, hi, color=C['ab'], alpha=0.15, lw=0, label='10%—90% 分位')
S = B['summary']
ax.axvline(S['sepMean'], color=C['mcts'], ls='--', lw=1.1); ax.text(S['sepMean'] + 1, 1900, f"平均分隔手数 ≈ {S['sepMean']:.0f}", color=C['mcts'], fontsize=8)
ax.set_yscale('log'); ax.set_ylim(0.8, 3500); ax.set_yticks([1, 10, 100, 1000, 2176]); ax.set_yticklabels(['1', '10', '100', '1000', '2176'])
ax.set_xlabel('手数（已走步数）'); ax.set_ylabel('合法着法数（对数坐标）'); ax.legend(loc='lower left'); ax.set_xlim(-0.5, 92)
save(fig, 'fig_branch')
print('basic figs done')
