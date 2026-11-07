"""开局图、封面图、失败案例棋盘图：python3 figs_misc.py"""
import json, os
from style import *
D = os.path.join(ROOT, 'data')
OP = json.load(open(os.path.join(D, 'openings.json')))['openings'][:16]
fig, axs = plt.subplots(2, 8, figsize=(6.9, 2.3))
for i, (ax, o) in enumerate(zip(axs.flat, OP)):
    draw_board(ax, o['moves'], coords=False, last=False, fs=3.2)
    ax.set_title(f'#{i + 1}（{o["eval"]:+.1f}）'.replace('-', '−'), fontsize=6.5, pad=2)
fig.subplots_adjust(wspace=0.08, hspace=0.3); save(fig, 'fig_openings')
# 封面：同预算 α-β 对 MCTS 的一局完整对局的终局
games = [json.loads(l) for l in open(os.path.join(D, 'raw', 'main.jsonl'))]
g = [g for g in games if g['tag'] == 'X:ab~mcts@800'][0]
fig, ax = plt.subplots(figsize=(4.4, 4.4)); draw_board(ax, g['moves'], coords=False, last=False)
save(fig, 'cover')
json.dump({'cover_game': g['id'], 'moves': g['moves'], 'winner': g['winner']}, open(os.path.join(D, 'cover_game.json'), 'w'))
print('cover', g['id'], g['length'])
# 失败案例
F = json.load(open(os.path.join(D, 'failure.json')))
def shade_of(terr):
    sh = {}
    for i, o in enumerate(terr['owner']):
        if o is None: continue
        sh[(i // 10, i % 10)] = '#BBD3EC' if o == 1 else '#F2C5B5' if o == -1 else '#DDDDDD'
    return sh
c1 = F['case1']
fig, axs = plt.subplots(1, 2, figsize=(6.8, 3.5))
p = c1['fillPly'] - 1
draw_board(axs[0], c1['moves'][:p], shade=shade_of(c1['terr']), title=f"(a) 第 {p + 1} 手前：旧判定认为已分隔")
draw_board(axs[1], c1['moves'][:c1['backPly'] - 1], title=f"(b) 第 {c1['backPly']} 手前：双方重新接触")
fig.tight_layout(); save(fig, 'fig_fail1')
if F['case2']['detail']:
    d = F['case2']['detail']
    fig, ax = plt.subplots(figsize=(3.6, 3.6))
    draw_board(ax, d['moves'][:d['ply']], shade=shade_of(d['terr']), title='分隔时刻的区域（蓝：白方，红：黑方）')
    save(fig, 'fig_fail2')
c3 = F.get('case3')
if c3:
    fig, axs = plt.subplots(1, 2, figsize=(6.8, 3.5))
    k = c3['ply'] - 1
    draw_board(axs[0], c3['moves'][:k], arrows=[(c3['played'], C['red'], None), (c3['deep']['move'], C['learn'], None)], last=False,
               title=f"(a) 第 {c3['ply']} 手：实走（红）与 5 s 搜索（绿）")
    xs = [t['ply'] for t in c3['trace']]; ys = [t['v'] for t in c3['trace']]
    axs[1].plot(xs, ys, 'o-', ms=3, color=C['ab'] if c3['loser'].startswith('ab') else C['mcts'])
    axs[1].axvline(c3['ply'], color=C['red'], ls='--', lw=0.8); axs[1].axhline(0, color='#666', lw=0.6)
    axs[1].set_xlabel('手数'); axs[1].set_ylabel('强方自己的评估（格）'); axs[1].set_title('(b) 强方每步的搜索评估', fontsize=9)
    fig.tight_layout(); save(fig, 'fig_fail3')
print('misc figs done')
