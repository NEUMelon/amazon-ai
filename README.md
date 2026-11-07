# 亚马逊棋博弈搜索算法研究（人工智能基础导论 第三次作业）

本目录是报告《亚马逊棋博弈搜索算法研究报告（人工智能算法）》对应的全部源代码与实验数据。

## 直接玩游戏

双击打开 `game/dist/amazons.html`（提交材料中另附同一文件 `amazons.html`）。它是单文件网页，不需要安装任何软件，也不需要联网。

- 右侧“对局设置”选择模式（人机我执白 / 我执黑、AI 对 AI 演示、双人）、双方 AI（8 种）和每步思考时间，点击“新局”；
- 走一步分三次点击：点击己方的后 → 点击绿色圆点（目的地）→ 点击红色圆点（射箭位置）；右键或 Esc 取消；
- “悔棋”（或 Ctrl+Z）撤回到上一次轮到你走；“提示”让 AI 为你推荐一手；AI 对 AI 时可暂停/继续；
- 棋盘上方的复选框控制领地、搜索候选、主变例、距离数字、箭的手数等图层；右侧标签页查看搜索过程、领地统计、局势曲线、棋谱（可复制、导出、导入）与算法说明。

## 目录结构

| 目录 | 内容 |
|---|---|
| `engine/` | 引擎：棋盘与走法生成（core.js）、距离与领地评估（eval.js）、着法排序与可分离评估（movegen.js）、α-β（search.js）、MCTS（mcts.js）、线性走子策略（policy.js）、智能体与填格策略（agents.js） |
| `game/` | 网页源代码（src/）、打包脚本（build.js）、打包结果（dist/amazons.html） |
| `experiments/` | 开局生成、任务清单、多进程对局、测试局面抽取、搜索效率、决策质量、随机性实验 |
| `learning/` | 特征抽取、策略训练、Texel 调参 |
| `models/` | 训练好的策略参数、Texel 权重与网页 AI 配置 |
| `analysis/` | 统计分析、失败案例复盘与生成报告表格的脚本 |
| `tests/` | 单元测试、界面自动化测试、截图、浏览器测速 |
| `data/` | 全部原始实验记录（对局逐步日志等，JSONL/JSON） |
| `data_v1/` | 第一版程序（分隔判定修复前）的实验记录，仅用于报告 5.10.1 节的对比 |
| `report/` | 报告的 Markdown 源文件、图表脚本、排版脚本 |
| `refs/` | 参考文献候选、检索核验脚本与核验记录 |

## 环境

Node.js ≥ 18（开发时为 22.23）；Python 3（NumPy、SciPy、Matplotlib、python-docx、lxml、Pillow）；生成报告还需要 pandoc、Graphviz 与 LibreOffice；界面测试需要 Playwright + Chromium。只玩游戏不需要任何环境。

## 复现

完整步骤与各步耗时见报告附录 C，简要如下（均在本目录下执行）：

```bash
node tests/run_tests.js                                    # 单元测试（27 项）
node experiments/make_openings.js
node experiments/make_jobs.js selfplay
node experiments/runner.js data/jobs/selfplay.json data/raw/selfplay.jsonl 4
node experiments/make_positions.js data/raw/selfplay.jsonl data/positions.json
node learning/extract.js data/raw/selfplay.jsonl data/learn  # 会重新生成 data/learn/policy_X.f32（未随包提交）
python3 learning/train_policy.py data/learn models
python3 learning/texel.py data/learn models
node game/build.js
node experiments/make_jobs.js main && node experiments/runner.js data/jobs/main.json data/raw/main.jsonl 4            # 2144 局
node experiments/make_jobs.js replicate && node experiments/runner.js data/jobs/replicate.json data/raw/replicate.jsonl 4  # 384 局
node experiments/efficiency.js data/positions.json data/efficiency.json
node experiments/quality.js ref data/positions.json data/quality_ref.json
node experiments/quality.js eval data/positions.json data/quality_ref.json data/quality.json ab,mcts-puct,mcts-cutoff,mcts-learned,ab-tuned,ab-cheapOrder,mcts-pure,greedy
node experiments/variance.js data/positions.json data/variance.json ab,mcts-puct,mcts-cutoff,mcts-learned
node analysis/branching.js data/raw/selfplay.jsonl && node analysis/failure.js
python3 analysis/analyze.py                                # 及 analysis/*_report.py、report/figscripts/*.py，见附录 C
node tests/ui_test.js && node tests/screenshots.js && node tests/browser_bench.js
python3 report/build.py                                    # 生成 Word 与 PDF
```

以时间为预算的搜索受机器速度与负载影响，在其他机器上重跑时个别对局会不同，统计结论应在置信区间内一致；以模拟次数为预算时 MCTS 的结果完全确定。

## 说明

- 报告中的所有数据都来自 `data/` 中的真实运行记录，表格与图由脚本直接生成；
- 第一版程序的分隔判定有漏洞（漏掉“敌对的后相邻”的情形），修复后重跑了全部实验；第一版数据保存在 `data_v1/`，报告 5.10.1 节与附录 B 如实说明了该漏洞及其影响；
- 本项目在编写代码、运行实验、核验文献与起草报告时使用了生成式 AI 工具（Claude），详见报告 3.7 节。
