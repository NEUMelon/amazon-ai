"""统一图表风格：字体、配色、尺寸。所有图由 figscripts/*.py 从真实实验数据生成。"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
import os, json
for f in fm.findSystemFonts():
    if 'NotoSansCJK' in f or 'NotoSerifCJK' in f: fm.fontManager.addfont(f)
plt.rcParams.update({
    'font.family': ['Noto Sans CJK SC', 'DejaVu Sans'], 'font.size': 9.5, 'axes.titlesize': 10.5, 'axes.labelsize': 9.5,
    'axes.edgecolor': '#4B5563', 'axes.linewidth': 0.8, 'axes.grid': True, 'grid.color': '#E5E7EB', 'grid.linewidth': 0.6,
    'axes.spines.top': False, 'axes.spines.right': False, 'xtick.color': '#374151', 'ytick.color': '#374151',
    'legend.frameon': False, 'legend.fontsize': 8.5, 'figure.dpi': 110, 'savefig.dpi': 220, 'savefig.bbox': 'tight',
    'axes.unicode_minus': False, 'mathtext.fontset': 'dejavusans',
})
# 配色：α-β 系列用蓝，MCTS 系列用橙，学习用绿，基线用灰
C = dict(ab='#1F4E79', ab2='#5B8DB8', mcts='#C2571A', mcts2='#E8A06A', learn='#2E7D32', base='#8A94A6', red='#B3261E',
         ink='#1F2A37', grid='#E5E7EB', gold='#B8860B', purple='#6A4C93')
SEQ = ['#1F4E79', '#C2571A', '#2E7D32', '#6A4C93', '#B8860B', '#8A94A6', '#B3261E', '#3B8EA5', '#7A5C3E', '#D16BA5']
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FIG = os.path.join(ROOT, 'report', 'figures')
def save(fig, name):
    fig.savefig(os.path.join(FIG, name + '.png')); plt.close(fig)

def sq_rc(s):
    """坐标字符串（如 'd1'）→ (行, 列)，行 0 为第 10 行"""
    return 10 - int(s[1:]), 'abcdefghij'.index(s[0])

def board_from_moves(moves):
    """按着法序列复原棋盘：返回 {(r,c): 'W'/'B'/'X'}"""
    cells = {}
    for s in ['a4', 'd1', 'g1', 'j4']: cells[sq_rc(s)] = 'W'
    for s in ['a7', 'd10', 'g10', 'j7']: cells[sq_rc(s)] = 'B'
    for m in moves:
        f, t, a = m.replace('/', '-').split('-')
        p = cells.pop(sq_rc(f)); cells[sq_rc(t)] = p; cells[sq_rc(a)] = 'X'
    return cells

def draw_board(ax, moves=(), shade=None, arrows=None, labels=None, title=None, last=True, coords=True, fs=6.5):
    """绘制亚马逊棋棋盘。moves：着法序列（白先）；shade：{(r,c): 颜色}；
    arrows：[(着法字符串, 颜色, 标签)] 以箭头画出“后的移动 + 射箭”；labels：{(r,c): (文字, 颜色)}"""
    import matplotlib.patches as mp
    cells = board_from_moves(moves)
    ax.set_xlim(-0.9, 10.1); ax.set_ylim(10.1, -0.9); ax.set_aspect('equal'); ax.axis('off')
    for r in range(10):
        for c in range(10):
            ax.add_patch(mp.Rectangle((c, r), 1, 1, fc='#E2D3B3' if (r + c) % 2 else '#F1E8D4', ec='none', zorder=0))
            if shade and (r, c) in shade and (r, c) not in cells:
                ax.add_patch(mp.Rectangle((c, r), 1, 1, fc=shade[(r, c)], ec='none', zorder=1))
    ax.add_patch(mp.Rectangle((0, 0), 10, 10, fc='none', ec='#4B5563', lw=0.8, zorder=2))
    lm = moves[-1] if (moves and last) else None
    if lm:
        f, t, a = lm.replace('/', '-').split('-')
        for s_ in (f, t):
            r, c = sq_rc(s_); ax.add_patch(mp.Rectangle((c, r), 1, 1, fc='#FFD600', alpha=0.35, ec='none', zorder=1))
    for (r, c), v in cells.items():
        if v == 'X':
            ax.add_patch(mp.Rectangle((c + 0.12, r + 0.12), 0.76, 0.76, fc='#8E3B2C' if lm and sq_rc(lm.split('/')[1]) == (r, c) else '#5D4A36', ec='none', zorder=3))
        else:
            ax.add_patch(mp.Circle((c + 0.5, r + 0.5), 0.38, fc='#FAFAFA' if v == 'W' else '#1A1A1A', ec='#1A1A1A', lw=0.7, zorder=3))
            if fs >= 4: ax.text(c + 0.5, r + 0.53, '♛', ha='center', va='center', fontsize=fs * 1.5, color='#7A5A10' if v == 'W' else '#F2D16B', zorder=4, family='DejaVu Sans')
    if labels:
        for (r, c), (txt, col) in labels.items():
            ax.text(c + 0.5, r + 0.52, txt, ha='center', va='center', fontsize=fs, color=col, zorder=5, fontweight='bold')
    if arrows:
        for m, col, lab in arrows:
            f, t, a = m.replace('/', '-').split('-')
            (r1, c1), (r2, c2), (r3, c3) = sq_rc(f), sq_rc(t), sq_rc(a)
            ax.annotate('', xy=(c2 + 0.5, r2 + 0.5), xytext=(c1 + 0.5, r1 + 0.5), arrowprops=dict(arrowstyle='-|>', color=col, lw=1.4, shrinkA=2, shrinkB=6), zorder=6)
            ax.annotate('', xy=(c3 + 0.5, r3 + 0.5), xytext=(c2 + 0.5, r2 + 0.5), arrowprops=dict(arrowstyle='-|>', color=col, lw=1.1, ls='--', shrinkA=6, shrinkB=2), zorder=6)
            ax.plot([c3 + 0.3, c3 + 0.7], [r3 + 0.3, r3 + 0.7], color=col, lw=1.2, zorder=6); ax.plot([c3 + 0.3, c3 + 0.7], [r3 + 0.7, r3 + 0.3], color=col, lw=1.2, zorder=6)
            if lab is not None: ax.text(c2 + 0.85, r2 + 0.15, str(lab), ha='center', va='center', fontsize=fs * 0.9, color='white', zorder=7,
                                        bbox=dict(boxstyle='circle,pad=0.15', fc=col, ec='none'))
    if coords:
        for j in range(10): ax.text(j + 0.5, 10.45, 'abcdefghij'[j], ha='center', va='center', fontsize=fs, color='#4B5563')
        for i in range(10): ax.text(-0.45, i + 0.5, str(10 - i), ha='center', va='center', fontsize=fs, color='#4B5563')
    if title: ax.set_title(title, fontsize=9)
