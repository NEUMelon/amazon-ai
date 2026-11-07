"""
训练线性 softmax 走法策略（条件 logit 模型），并在留出对局上评估。
    python3 learning/train_policy.py data/learn models
目标函数：  L(θ) = -(1/M) Σ_i log π_θ(a_i | x_i) + λ/2 ||θ||²
优化：全批量 Adam，学习率 0.05，2000 步；按对局编号划分训练集（前 80%）与测试集（后 20%），
保证同一对局的局面不会同时出现在训练集和测试集中。
对照：均匀分布；“可分离评估排序”（候选按可分离评估分数排序，即 MCTS 中 order='sep' 的顺序）；
      以及与 mcts-puct 相同的启发式先验 softmax(可分离评估分数 / τ)，τ=1。
"""
import json, sys, os
import numpy as np

src, out = sys.argv[1], sys.argv[2]
meta = json.load(open(os.path.join(src, 'policy_meta.json')))
D = meta['dim']; names = meta['names']
X = np.fromfile(os.path.join(src, 'policy_X.f32'), dtype=np.float32).reshape(-1, D).astype(np.float64)
rows = np.array(meta['rows'], dtype=np.int64)
game, ply, ncand, chosen = rows.T
offs = np.concatenate([[0], np.cumsum(ncand)])
ngame = game.max() + 1
split = int(ngame * 0.8)
tr = game < split; te = ~tr
seg = np.repeat(np.arange(len(rows)), ncand)
chosen_flat = offs[:-1] + chosen
trw = tr[seg].astype(float); Ntr = tr.sum()

def softmax_seg(z):
    zmax = np.full(len(rows), -np.inf); np.maximum.at(zmax, seg, z)
    e = np.exp(z - zmax[seg]); s = np.zeros(len(rows)); np.add.at(s, seg, e)
    return e / s[seg]

def metrics(z, mask):
    p = softmax_seg(z)
    idx = np.where(mask)[0]
    nll = float(-np.mean(np.log(p[chosen_flat[idx]] + 1e-12)))
    ranks = np.array([np.sum(z[offs[i]:offs[i + 1]] > z[offs[i] + chosen[i]]) for i in idx])
    return dict(nll=nll, top1=float(np.mean(ranks < 1)), top3=float(np.mean(ranks < 3)), top5=float(np.mean(ranks < 5)), top10=float(np.mean(ranks < 10)), n=int(len(idx)))

def train(cols, steps=2000, lr=0.05, lam=1e-3, log=False):
    Xm = X * cols[None, :]
    th = np.zeros(D); m = np.zeros(D); v = np.zeros(D); b1, b2 = 0.9, 0.999; curve = []
    for t in range(1, steps + 1):
        p = softmax_seg(Xm @ th)
        g = (Xm * (p * trw)[:, None]).sum(0) - Xm[chosen_flat[tr]].sum(0)
        g = g / Ntr + lam * th
        m = b1 * m + (1 - b1) * g; v = b2 * v + (1 - b2) * g * g
        th -= lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + 1e-8)
        if log and (t % 100 == 0 or t == 1):
            idx = np.where(tr)[0]; idx2 = np.where(te)[0]
            curve.append((t, float(-np.mean(np.log(p[chosen_flat[idx]] + 1e-12))), float(-np.mean(np.log(p[chosen_flat[idx2]] + 1e-12)))))
            print(t, curve[-1])
    return th, curve

theta, curve = train(np.ones(D), log=True)
res = dict(train=metrics(X @ theta, tr), test=metrics(X @ theta, te))
# 对照
sep = X[:, D - 1] * 4                    # 可分离评估分数差（格）
order_z = -np.concatenate([np.arange(n) for n in ncand]).astype(float)   # 候选按可分离评估排序后的名次
baselines = dict(
    uniform=dict(nll=float(np.mean(np.log(ncand[te]))), top1=float(np.mean(1 / ncand[te]))),
    sep_rank=metrics(order_z + 1e-6 * sep, te),
    sep_softmax_tau1=metrics(sep, te),
)
# 消融：只用可分离评估分数 / 不用可分离评估分数
abl = {}
for nm, cols in [('sep_only', [D - 1]), ('no_sep', list(range(D - 1)))]:
    c = np.zeros(D); c[cols] = 1
    th, _ = train(c, steps=1500)
    abl[nm] = dict(theta=th.tolist(), test=metrics((X * c[None, :]) @ th, te))
report = dict(result=res, baselines=baselines, ablation=abl, n_train_games=int(split), n_test_games=int(ngame - split),
              n_train=int(tr.sum()), n_test=int(te.sum()), coverage=meta['coverage'], pre=meta['pre'],
              mean_candidates=float(ncand.mean()), steps=2000, lr=0.05, lam=1e-3, curve=curve,
              theta=dict(zip(names, map(float, theta))))
print(json.dumps({k: v for k, v in report.items() if k not in ('curve',)}, indent=1, ensure_ascii=False))
os.makedirs(out, exist_ok=True)
json.dump(dict(theta=theta.tolist(), names=names, report=report), open(os.path.join(out, 'policy_weights.json'), 'w'), indent=1, ensure_ascii=False)
