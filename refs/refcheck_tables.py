"""生成附录 D 的核验统计表：python3 refs/refcheck_tables.py"""
import json, os, re, collections
H = os.path.dirname(os.path.abspath(__file__)); T = os.path.join(H, '..', 'report', 'tables')
d = json.load(open(os.path.join(H, 'verified.json')))
labels = json.load(open(os.path.join(H, '..', 'report', 'build', 'labels.json')))
cited = set(labels['cites'])
SRC = {'crossref': 'Crossref（DOI 元数据）', 'arxiv': 'arXiv API', 'openlibrary': 'OpenLibrary（图书）', 'neurips': 'NeurIPS 论文集目录', 'url': '官方页面核对'}
rows = collections.Counter(); rows_c = collections.Counter()
for k, v in d.items():
    if v['status'] != 'verified': continue
    g = '主题检索补充' if k.startswith('cr_') else '记忆候选'
    rows[(g, v['source'])] += 1
    if k in cited: rows_c[(g, v['source'])] += 1
L = ['| 来源 | 核验渠道 | 核验通过 | 其中被正文引用 |', '|---|---|---|---|']
for (g, s), n in sorted(rows.items()): L.append(f'| {g} | {SRC.get(s, s)} | {n} | {rows_c[(g, s)]} |')
L.append(f'| 合计 | — | {sum(rows.values())} | {sum(rows_c.values())} |')
open(os.path.join(T, 'refcheck_summary.md'), 'w').write('\n'.join(L) + '\n')
REPL = {'turing1953': 'cr_turing1988_359', 'wagner2001': 'cr_wgner2001_726', 'erdos1973': 'cr_erds1973_392', 'kishimoto2005': 'cr_kishimoto2005_680'}
L = ['| 候选键 | 候选信息（作者，年份，题名） | 处理 |', '|---|---|---|']
for k, v in d.items():
    if v['status'] == 'verified': continue
    q = v['query']
    t = q['title'].replace('|', '/')
    act = f'弃用；改引主题检索中找到的对应条目（{REPL[k]}）' if k in REPL else '弃用，正文不引用'
    L.append(f"| `{k}` | {q['author']}，{q['year']}，{t} | {act} |")
open(os.path.join(T, 'refcheck_failed.md'), 'w').write('\n'.join(L) + '\n')
unc = [k for k, v in d.items() if v['status'] == 'verified' and k not in cited]
print('verified', sum(rows.values()), 'cited', len(cited & {k for k, v in d.items() if v['status'] == 'verified'}), 'uncited', unc)
