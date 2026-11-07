"""
Texel 方法拟合评估函数权重：
    python3 learning/texel.py data/learn models
模型：P(白方获胜 | 局面) = σ(K · v_W)，v_W = w · x 为白方视角评估值（x 为 10 维阶段加权特征）。
步骤（与 Texel 原始做法一致）：
  1) 固定手工权重 w0，只拟合缩放系数 K（一维搜索）；
  2) 固定 K，用 L-BFGS 最小化训练集交叉熵（加微弱 L2 正则，向 w0 收缩），得到 w*。
按对局编号 80/20 划分训练/测试集。报告训练、测试交叉熵与预测准确率。
"""
import json, sys, os
import numpy as np
from scipy.optimize import minimize, minimize_scalar

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(src, 'texel.json')))
rows = d['rows']
X = np.array([r['x'] for r in rows]); y = np.array([r['y'] for r in rows], float); g = np.array([r['g'] for r in rows]); k = np.array([r['k'] for r in rows])
ng = g.max() + 1; split = int(ng * 0.8)
tr = g < split; te = ~tr
w0 = np.array([0.20, 0.20, 0.30, 0.30, 0.25, 1.00, 0.20, 0.05, 0.05, 0.05])   # 与 eval.js 中 DEFAULT_WEIGHTS 一致

def ce(w, K, m):
    z = K * (X[m] @ w); p = 1 / (1 + np.exp(-z))
    return float(-np.mean(y[m] * np.log(p + 1e-12) + (1 - y[m]) * np.log(1 - p + 1e-12)))
def acc(w, m):
    v = X[m] @ w
    return float(np.mean((v > 0) == (y[m] > 0.5)))

rK = minimize_scalar(lambda K: ce(w0, K, tr), bounds=(1e-3, 5), method='bounded')
K = float(rK.x)
lam = 1e-4
def obj(w):
    z = K * (X[tr] @ w); p = 1 / (1 + np.exp(-z))
    f = -np.mean(y[tr] * np.log(p + 1e-12) + (1 - y[tr]) * np.log(1 - p + 1e-12)) + lam * np.sum((w - w0) ** 2)
    gr = K * X[tr].T @ (p - y[tr]) / tr.sum() + 2 * lam * (w - w0)
    return f, gr
r = minimize(obj, w0, jac=True, method='L-BFGS-B')
w = r.x
# 再拟合一次 K（便于把评估值换算为胜率）
K2 = float(minimize_scalar(lambda kk: ce(w, kk, tr), bounds=(1e-3, 5), method='bounded').x)
# 按对局阶段（手数）分组的测试集交叉熵
bins = [(0, 20), (20, 40), (40, 60), (60, 100)]
by_phase = {f'{a}-{b}': dict(n=int(((k >= a) & (k < b) & te).sum()), hand=ce(w0, K, (k >= a) & (k < b) & te), tuned=ce(w, K2, (k >= a) & (k < b) & te))
            for a, b in bins if ((k >= a) & (k < b) & te).sum() > 0}
names = [f'{n}_open' for n in d['names']] + [f'{n}_end' for n in d['names']]
rep = dict(K_hand=K, K_tuned=K2, n_train=int(tr.sum()), n_test=int(te.sum()), n_games=int(ng),
           white_win_rate=float(y.mean()),
           hand=dict(train_ce=ce(w0, K, tr), test_ce=ce(w0, K, te), test_acc=acc(w0, te)),
           tuned=dict(train_ce=ce(w, K2, tr), test_ce=ce(w, K2, te), test_acc=acc(w, te)),
           baseline_ce=float(-np.mean(y[te] * np.log(y[tr].mean()) + (1 - y[te]) * np.log(1 - y[tr].mean()))),
           by_phase=by_phase, weights_hand=dict(zip(names, w0.tolist())), weights_tuned=dict(zip(names, w.tolist())), lam=lam)
print(json.dumps(rep, indent=1, ensure_ascii=False))
os.makedirs(out, exist_ok=True)
json.dump(dict(weights=w.tolist(), K=K2, K_hand=K, names=names, report=rep), open(os.path.join(out, 'eval_weights_tuned.json'), 'w'), indent=1, ensure_ascii=False)
