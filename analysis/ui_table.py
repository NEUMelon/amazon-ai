"""界面测试结果表：python3 analysis/ui_table.py（输入 data/ui_test.json，输出 report/tables/ui_tests.md）"""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U = json.load(open(os.path.join(R, 'data', 'ui_test.json')))
L = ['| 编号 | 测试项 | 结果 | 观测 |', '|---|---|---|---|']
for r in U['results']:
    d = r['detail'].replace('|', '／')
    L.append(f"| {r['id']} | {r['name']} | {'通过' if r['ok'] else '**未通过**'} | {d} |")
open(os.path.join(R, 'report', 'tables', 'ui_tests.md'), 'w').write('\n'.join(L) + '\n')
print(sum(r['ok'] for r in U['results']), '/', len(U['results']))
