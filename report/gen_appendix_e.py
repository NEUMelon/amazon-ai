"""生成附录 E（源代码清单），行数从源文件实时统计。python3 report/gen_appendix_e.py"""
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['engine/core.js', 'engine/eval.js', 'engine/movegen.js', 'engine/search.js', 'engine/mcts.js', 'engine/policy.js', 'engine/agents.js',
         'engine/index.js', 'game/src/app.js', 'game/src/worker.js', 'game/build.js', 'experiments/arena.js', 'experiments/runner.js', 'experiments/make_jobs.js']
out = ['# 附录E　源代码', '', '本附录收录引擎、网页逻辑与对局实验框架的全部源代码（由排版脚本直接从源文件读取）。网页的 HTML/CSS、其余实验脚本、学习脚本、分析脚本与测试代码见提交的源代码包。代码中的注释为中文，便于阅读。', '']
for f in FILES:
    n = len(open(os.path.join(R, f), encoding='utf8').read().rstrip('\n').split('\n'))
    out += [f'## `{f}`（{n} 行） {{-}}', '', f'::src {f} 1 {n}', '']
open(os.path.join(R, 'report', 'chapters', 'E_source.md'), 'w').write('\n'.join(out))
print('ok')
