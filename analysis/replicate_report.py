"""重复实验（新种子重跑四组关键对比）的表：python3 analysis/replicate_report.py
输入 data/raw/replicate.jsonl 与 data/raw/main.jsonl；输出 report/tables/replicate.md、data/replicate_summary.json"""
import json, os, math, random
from collections import defaultdict
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'data'); T = os.path.join(ROOT, 'report', 'tables')
load = lambda p: [json.loads(l) for l in open(p) if l.strip()]
rep = load(os.path.join(D, 'raw', 'replicate.jsonl')); main = load(os.path.join(D, 'raw', 'main.jsonl'))
def wilson(k, n, z=1.96):
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return c - h, c + h
def is_plain(spec, agent): return spec['agent'] == agent and spec['opts'].get('timeMs') == 200 and len(spec['opts']) == 1
def stats(games, a):
    w = 0; pair = defaultdict(float)
    for g in games:
        a_col = 1 if is_plain(g['white'], a) else 2
        s = 1.0 if g['winner'] == a_col else 0.0
        w += s; pair[g['tag'] + '|' + g['id'].split('|')[1]] += s
    n = len(games); sc = w / n; lo, hi = wilson(w, n)
    keys = list(pair); rnd = random.Random(1); bs = []
    for _ in range(4000): bs.append(sum(pair[rnd.choice(keys)] for _ in keys) / (2 * len(keys)))
    bs.sort()
    return dict(n=n, w=int(w), l=int(n - w), score=sc, wlo=lo, whi=hi, blo=bs[100], bhi=bs[3899])
GROUPS = [('α-β（完整）对 MCTS-PUCT', 'ab', 'mcts-puct', ['X:ab~mcts@200', 'T:ab~mcts-puct']),
          ('学习先验 MCTS 对 MCTS-PUCT', 'mcts-learned', 'mcts-puct', ['M:learned', 'T:mcts-puct~mcts-learned']),
          ('Texel 权重 α-β 对 完整 α-β', 'ab-tuned', 'ab', ['T:ab~ab-tuned']),
          ('MCTS-PUCT 对 MCTS（UCT+截断）', 'mcts-puct', 'mcts-cutoff', ['T:mcts-cutoff~mcts-puct'])]
L = ['| 对比（A 对 B） | 批次 | 局数 | A 胜–负 | A 得分率 | Wilson 95% 区间 | 开局配对自助 95% 区间 |', '|---|---|---|---|---|---|---|']
out = {}
for title, a, b, mtags in GROUPS:
    rows = []
    for t in mtags:
        gs = [g for g in main if g['tag'] == t]
        if gs: rows.append((f'主实验 {t.split(":")[0]} 组', gs))
    for r in (1, 2, 3):
        gs = [g for g in rep if g['tag'] == f'R{r}:{a}~{b}']
        if gs: rows.append((f'重复 {r}', gs))
    allg = [g for _, gs in rows for g in gs]
    res = []
    for k, (name, gs) in enumerate(rows + [('合计', allg)]):
        s = stats(gs, a); res.append(dict(batch=name, **s))
        L.append(f"| {title if k == 0 else ''} | {'**合计**' if name == '合计' else name} | {s['n']} | {s['w']}–{s['l']} | {s['score'] * 100:.1f}% | [{s['wlo'] * 100:.1f}, {s['whi'] * 100:.1f}] | [{s['blo'] * 100:.1f}, {s['bhi'] * 100:.1f}] |")
    out[title] = res
open(os.path.join(T, 'replicate.md'), 'w').write('\n'.join(L) + '\n')
json.dump(out, open(os.path.join(D, 'replicate_summary.json'), 'w'), ensure_ascii=False, indent=1)
print(open(os.path.join(T, 'replicate.md')).read())
