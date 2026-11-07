"""附录 B 的数据表：python3 analysis/appendix_tables.py
输入 data/raw/*.jsonl、data/openings.json、data/analysis.json、data_v1/analysis.json；输出 report/tables/B_*.md"""
import json, os, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(R, 'data'); T = os.path.join(R, 'report', 'tables')
NAME = {'random': '随机', 'greedy': '一步贪心', 'ab': 'α-β（完整）', 'ab-tuned': 'α-β（Texel 权重）', 'mcts-pure': 'MCTS（纯随机）',
        'mcts-cutoff': 'MCTS（UCT+截断）', 'mcts-puct': 'MCTS-PUCT', 'mcts-learned': 'MCTS（学习先验）'}
load = lambda p: [json.loads(l) for l in open(p) if l.strip()]
games = load(os.path.join(D, 'raw', 'main.jsonl'))
by = collections.defaultdict(list)
for g in games: by[g['tag']].append(g)
def sA(g):  # id 以 |AB 结尾表示 A 执白
    return 1.0 if (g['winner'] == 1) == g['id'].endswith('|AB') else 0.0

# 循环赛逐对结果
L = ['| 序号 | A | B | A 胜–负 | A 得分率 | A 执白时得分 | A 执黑时得分 | 平均手数 |', '|---|---|---|---|---|---|---|---|']
k = 0
for tag, gs in by.items():
    if not tag.startswith('T:'): continue
    k += 1; a, b = tag[2:].split('~'); sc = [sA(g) for g in gs]; w = int(sum(sc))
    sw = sum(sA(g) for g in gs if g['id'].endswith('|AB')); sb = sum(sA(g) for g in gs if g['id'].endswith('|BA'))
    L.append(f'| {k} | {NAME[a]} | {NAME[b]} | {w}–{len(sc) - w} | {w / len(sc) * 100:.1f}% | {sw:g}/16 | {sb:g}/16 | {sum(g["length"] for g in gs) / len(gs):.1f} |')
open(os.path.join(T, 'B_pairs.md'), 'w').write('\n'.join(L) + '\n')

# 各实验组概况
GN = {'T': '循环赛', 'A': 'α-β 消融', 'M': 'MCTS 消融', 'S': '算力缩放', 'X': '同预算 α-β 对 MCTS'}
L = ['| 实验组 | 对阵组数 | 对局数 | 白方胜率 | 平均手数 | 总着法数 | 单局平均墙钟时间/s |', '|---|---|---|---|---|---|---|']
for gk, nm in GN.items():
    gs = [g for g in games if g['tag'].startswith(gk + ':')]; n = len(gs)
    L.append(f'| {gk}（{nm}） | {len({g["tag"] for g in gs})} | {n} | {sum(g["winner"] == 1 for g in gs) / n * 100:.1f}% | {sum(g["length"] for g in gs) / n:.1f} | {sum(len(g["log"]) for g in gs):,} | {sum(g["wallMs"] for g in gs) / n / 1000:.1f} |')
n = len(games)
L.append(f'| 合计 | {len(by)} | {n} | {sum(g["winner"] == 1 for g in games) / n * 100:.1f}% | {sum(g["length"] for g in games) / n:.1f} | {sum(len(g["log"]) for g in games):,} | {sum(g["wallMs"] for g in games) / n / 1000:.1f} |')
open(os.path.join(T, 'B_groups.md'), 'w').write('\n'.join(L) + '\n')
wall_h = sum(g['wallMs'] for g in games) / 3.6e6

# 各开局的统计
ops = json.load(open(os.path.join(D, 'openings.json')))['openings']
byop = collections.defaultdict(list)
for g in games: byop[int(g['id'].split('|')[1])].append(g)
L = ['| 开局 | 前两手 | 1 秒 α-β 评估（白方视角） | 对局数 | 白方胜率 | 平均手数 |', '|---|---|---|---|---|---|']
for k in sorted(byop):
    gs = byop[k]; n = len(gs)
    L.append(f'| #{k + 1} | {" ".join(gs[0]["opening"])} | {ops[k]["eval"]:+.2f} | {n} | {sum(g["winner"] == 1 for g in gs) / n * 100:.1f}% | {sum(g["length"] for g in gs) / n:.1f} |'.replace('|-', '|−').replace(' -', ' −'))
open(os.path.join(T, 'B_openings.md'), 'w').write('\n'.join(L) + '\n')

# 自对弈数据
sp = load(os.path.join(D, 'raw', 'selfplay.jsonl'))
ww = sum(g['winner'] == 1 for g in sp)
L = ['| 项目 | 数值 |', '|---|---|', f'| 对局数 | {len(sp)}（前 320 局训练，后 80 局测试） |', f'| 白胜 / 黑胜 | {ww} / {len(sp) - ww} |',
     f'| 平均手数（含开局） | {sum(g["length"] for g in sp) / len(sp):.1f} |', '| 开局 | 随机 2—4 手，每手从可分离评估前 40 名中均匀选取 |',
     '| 双方配置 | 完整 α-β，200 ms/步 |']
open(os.path.join(T, 'B_selfplay.md'), 'w').write('\n'.join(L) + '\n')

# 第一版程序（分隔判定修复前）与当前版本的 Elo 对比
cur = json.load(open(os.path.join(D, 'analysis.json'))); v1p = os.path.join(R, 'data_v1', 'analysis.json')
if os.path.exists(v1p):
    v1 = json.load(open(v1p))
    def rows(a):
        return {p: (a['elo'][i], a['elo_ci'][0][i], a['elo_ci'][1][i]) for i, p in enumerate(a['pool'])}
    rc, r1 = rows(cur), rows(v1)
    f = lambda x: '≤−1200' if x < -1200 else f'{x:+.0f}'.replace('-', '−')
    L = ['| 智能体 | 第一版 Elo | 第一版 95% 区间 | 修复后 Elo | 修复后 95% 区间 |', '|---|---|---|---|---|']
    for p in sorted(rc, key=lambda p: -rc[p][0]):
        a, b = r1[p], rc[p]
        L.append(f'| {NAME[p]} | {f(a[0])} | [{f(a[1])}, {f(a[2])}] | {f(b[0])} | [{f(b[1])}, {f(b[2])}] |')
    open(os.path.join(T, 'B_v1.md'), 'w').write('\n'.join(L) + '\n')

# 数据文件清单
FILES = [('data/raw/main.jsonl', '主实验 2144 局逐局记录（每步着法、用时、理由、深度、结点数、模拟次数等）'), ('data/jobs/main.json', '主实验任务清单（双方配置、开局、种子）'),
         ('data/raw/selfplay.jsonl', '自对弈 400 局（学习数据）'), ('data/raw/replicate.jsonl', '重复实验 384 局'),
         ('data/raw/pilot_tau.jsonl', '参数试调对局（第 17—32 号开局，第一版程序）'), ('data/raw/pilot_tau2.jsonl', '参数试调对局（续）'),
         ('data/openings.json', '开局生成记录（含 1 秒 α-β 评估）'), ('data/positions.json', '60 个测试局面'),
         ('data/efficiency.json', '搜索效率实验原始数据'), ('data/quality_ref.json', '决策质量测试的参考搜索结果'), ('data/quality.json', '各智能体的决策质量测试结果'),
         ('data/variance.json', '决策随机性实验原始数据'), ('data/browser_bench.json', '浏览器速度测试结果'), ('data/ui_test.json', '界面自动化测试结果'),
         ('data/branching.json', '自对弈局面的合法着法数与分隔手数'), ('data/failure.json', '失败案例复盘数据'), ('data/analysis.json', '主实验统计分析结果'),
         ('data/learn/policy_meta.json', '策略学习样本元数据'), ('data/learn/texel.json', 'Texel 调参报告'),
         ('models/policy_weights.json', '线性策略参数与训练报告'), ('models/eval_weights_tuned.json', 'Texel 权重'),
         ('data_v1/raw/main.jsonl', '第一版程序（分隔判定修复前）的主实验记录，仅用于 5.10.1 节')]
L = ['| 文件 | 大小 | 内容 |', '|---|---|---|']
for fn, desc in FILES:
    p = os.path.join(R, fn)
    if os.path.exists(p):
        sz = os.path.getsize(p); s = f'{sz / 1e6:.1f} MB' if sz > 1e6 else f'{max(1, round(sz / 1e3))} KB'
        L.append(f'| `{fn}` | {s} | {desc} |')
open(os.path.join(T, 'B_files.md'), 'w').write('\n'.join(L) + '\n')
print('total wall h', round(wall_h, 2)); print('appendix tables ok')
