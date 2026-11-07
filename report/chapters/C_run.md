# 附录C　运行说明

## 代码仓库与在线试玩 {-}

本项目的全部源代码、原始实验数据与报告源文件公开在 GitHub 仓库 https://github.com/NEUMelon/amazon-ai 中；网页游戏同时通过 GitHub Pages 发布，可在 https://neumelon.github.io/amazon-ai/ 直接在线试玩，页面上也提供报告 PDF 的下载。仓库中只省略了一个可由脚本重新生成的学习中间文件（`data/learn/policy_X.f32`，约 40 MB）。

## 直接运行游戏 {-}

提交材料中的 `amazons.html` 是一个完全独立的单文件网页（约 160 KB），包含界面、引擎与模型参数，不需要安装任何软件，也不需要网络连接：

1. 用 Chrome、Edge、Firefox 或 Safari 的较新版本**双击打开** `amazons.html`；
2. 在右侧“对局设置”中选择模式（人机对弈我执白 / 我执黑、AI 对 AI 演示、双人对弈）、双方的 AI 算法和每步思考时间，点击“新局”；
3. 人类走子分三次点击：先点击己方的一个后，再点击绿色圆点（目的地），最后点击红色圆点（射箭位置）；右键或 Esc 取消选择。“悔棋”撤回到上一次轮到人类走棋时；“提示”让 AI 为当前行棋方推荐一手；AI 对 AI 时可“暂停/继续”；
4. 棋盘上方的复选框控制各可视化图层（领地、搜索候选、主变例、距离数字、箭的手数），右侧标签页查看搜索过程、局势曲线、棋谱与算法说明。

## 开发环境 {-}

本项目在以下环境中开发与运行：Linux（x86-64，4 个 CPU 核心），Node.js 22.23，Python 3.13（NumPy 2.5、SciPy 1.18、Matplotlib 3.11），Graphviz 2.43，pandoc 3.1，LibreOffice 24.2。引擎与网页只依赖 Node.js（运行实验）或浏览器（运行游戏）；Python 仅用于离线训练、统计与绘图，Playwright 仅用于界面测试与截图。

## 复现步骤 {-}

源代码包解压后，在项目根目录依次执行下列命令即可复现全部结果。括号中为在上述环境中的大致耗时。

```bash
# 1. 单元测试（约 1 分钟）
node tests/run_tests.js
# 2. 生成均衡开局与任务清单
node experiments/make_openings.js
node experiments/make_jobs.js selfplay
# 3. 自对弈（400 局，4 进程）
node experiments/runner.js data/jobs/selfplay.json data/raw/selfplay.jsonl 4
# 4. 测试局面、学习数据抽取、策略训练与 Texel 调参
node experiments/make_positions.js data/raw/selfplay.jsonl data/positions.json
node learning/extract.js data/raw/selfplay.jsonl data/learn
python3 learning/train_policy.py data/learn models
python3 learning/texel.py data/learn models
# 5. 打包网页
node game/build.js
# 6. 主实验（中断后重新执行同一命令会自动续跑）
node experiments/make_jobs.js main
node experiments/runner.js data/jobs/main.json data/raw/main.jsonl 4
# 6b. 重复实验
node experiments/make_jobs.js replicate
node experiments/runner.js data/jobs/replicate.json data/raw/replicate.jsonl 4
# 7. 专项实验（单进程运行，避免计时干扰）
node experiments/efficiency.js data/positions.json data/efficiency.json
node experiments/quality.js ref data/positions.json data/quality_ref.json
node experiments/quality.js eval data/positions.json data/quality_ref.json data/quality.json ab,mcts-puct,mcts-cutoff,mcts-learned,ab-tuned,ab-cheapOrder,mcts-pure,greedy
node experiments/variance.js data/positions.json data/variance.json ab,mcts-puct,mcts-cutoff,mcts-learned
node analysis/branching.js data/raw/selfplay.jsonl
node analysis/failure.js
# 8. 统计分析与绘图
python3 analysis/analyze.py
python3 analysis/learn_tables.py
python3 analysis/efficiency_report.py
python3 analysis/replicate_report.py
python3 analysis/appendix_tables.py
python3 report/figscripts/figs_basic.py
python3 report/figscripts/figs_results.py
python3 report/figscripts/figs_misc.py
# 9. 界面测试与截图
node tests/ui_test.js
node tests/screenshots.js
python3 report/figscripts/crop_ui.py
node tests/browser_bench.js
python3 analysis/ui_table.py
# 10. 生成报告（Word + PDF）
python3 report/gen_appendix_e.py
python3 report/build.py
```

## 关于可重复性的说明 {-}

- 所有随机过程（Zobrist 随机数、开局生成、自对弈开局、MCTS 与随机智能体）都使用固定种子，种子写在任务清单中；
- 以**时间**为预算的搜索（α-β 的迭代加深何时停止、MCTS 做多少次模拟）受机器速度与负载影响，因此在不同机器上重跑时，具体对局的着法可能不同，统计结论应在置信区间范围内一致；以**模拟次数**为预算时，MCTS 的结果完全确定（单元测试“相同种子可复现”）；
- 学习脚本使用全批量优化，结果确定。
