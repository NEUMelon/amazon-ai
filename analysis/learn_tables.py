"""学习部分的表格：python3 analysis/learn_tables.py"""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); T = os.path.join(R, 'report', 'tables')
os.makedirs(T, exist_ok=True)
P = json.load(open(os.path.join(R, 'models', 'policy_weights.json')))['report']
f = lambda x: f'{x * 100:.1f}%'
B = P['baselines']; t = P['result']['test']; tr = P['result']['train']
L = ['| 模型 | 测试集 NLL / nat | Top-1 | Top-3 | Top-5 | Top-10 |', '|---|---|---|---|---|---|',
     f"| 均匀分布（基线） | {B['uniform']['nll']:.3f} | {f(B['uniform']['top1'])} | — | — | — |",
     f"| 可分离评估排序（按名次） | — | {f(B['sep_rank']['top1'])} | {f(B['sep_rank']['top3'])} | {f(B['sep_rank']['top5'])} | {f(B['sep_rank']['top10'])} |",
     f"| 可分离评估 softmax（τ = 1） | {B['sep_softmax_tau1']['nll']:.3f} | {f(B['sep_softmax_tau1']['top1'])} | {f(B['sep_softmax_tau1']['top3'])} | {f(B['sep_softmax_tau1']['top5'])} | {f(B['sep_softmax_tau1']['top10'])} |",
     f"| **学习策略（12 维，完整）** | **{t['nll']:.3f}** | {f(t['top1'])} | {f(t['top3'])} | {f(t['top5'])} | {f(t['top10'])} |"]
AB = {'sep_only': '消融：只用可分离评估分数（相当于学习温度）', 'no_sep': '消融：去掉可分离评估分数（11 维）'}
for k, name in AB.items():
    x = P['ablation'][k]['test']; L.append(f"| {name} | {x['nll']:.3f} | {f(x['top1'])} | {f(x['top3'])} | {f(x['top5'])} | {f(x['top10'])} |")
L.append(f"| （参考）学习策略在训练集上 | {tr['nll']:.3f} | {f(tr['top1'])} | {f(tr['top3'])} | {f(tr['top5'])} | {f(tr['top10'])} |")
open(os.path.join(T, 'policy.md'), 'w').write('\n'.join(L) + '\n')
# 参数表
th = P['theta']; sep_only = P['ablation']['sep_only']['theta'][-1]
L = ['| 特征 | 学习到的系数 θ |', '|---|---|'] + [f'| `{k}` | {v:+.3f} |'.replace('-', '−') for k, v in th.items()]
open(os.path.join(T, 'policy_theta.md'), 'w').write('\n'.join(L) + '\n')
E = json.load(open(os.path.join(R, 'models', 'eval_weights_tuned.json')))['report']
L = ['| 模型 | 参数数 | 训练集交叉熵 | 测试集交叉熵 | 测试集预测准确率 |', '|---|---|---|---|---|',
     f"| 常数模型（只预测白方胜率 {E['white_win_rate'] * 100:.1f}%） | 1 | — | {E['baseline_ce']:.3f} | — |",
     f"| 手工权重，只拟合尺度 K（K = {E['K_hand']:.3f}） | 1 | {E['hand']['train_ce']:.3f} | {E['hand']['test_ce']:.3f} | {f(E['hand']['test_acc'])} |",
     f"| Texel 调参（λ = {E['lam']:g}，K = {E['K_tuned']:.3f}） | 10 | {E['tuned']['train_ce']:.3f} | {E['tuned']['test_ce']:.3f} | {f(E['tuned']['test_acc'])} |"]
open(os.path.join(T, 'texel.md'), 'w').write('\n'.join(L) + '\n')
L = ['| 手数区间 | 测试局面数 | 手工权重交叉熵 | Texel 权重交叉熵 |', '|---|---|---|---|']
for k, v in E['by_phase'].items(): L.append(f"| {k} | {v['n']} | {v['hand']:.3f} | {v['tuned']:.3f} |")
open(os.path.join(T, 'texel_phase.md'), 'w').write('\n'.join(L) + '\n')
wh, wt = E['weights_hand'], E['weights_tuned']
L = ['| 特征 | 开局权重（手工） | 开局权重（Texel） | 后期权重（手工） | 后期权重（Texel） |', '|---|---|---|---|---|']
for k in ['t1', 't2', 'c1', 'c2', 'mob']:
    L.append(f"| {k} | {wh[k + '_open']:.2f} | {wt[k + '_open']:+.3f} | {wh[k + '_end']:.2f} | {wt[k + '_end']:+.3f} |".replace('+-', '−').replace('-', '−'))
open(os.path.join(T, 'texel_weights.md'), 'w').write('\n'.join(L) + '\n')
print(*(open(os.path.join(T, n)).read() for n in ['policy.md', 'policy_theta.md', 'texel.md', 'texel_phase.md', 'texel_weights.md']), sep='\n')
print('sep_only theta', sep_only, 'equiv tau', 4 / sep_only)
