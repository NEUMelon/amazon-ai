# 附录B　实验数据明细

本附录列出正文统计所依据的原始数据概况与逐组明细。所有数值都由 `analysis/appendix_tables.py` 等脚本直接从 `data/` 下的原始记录计算，未做任何手工修改。

## 各实验组概况 {-}

::tab bgroups | 主实验各组概况

::include tables/B_groups.md

::note 注：“单局平均墙钟时间”是单个对局从开始到结束的时间。实验以 4 个进程并行，2144 局的单局时间累计约 6.7 小时，实际墙钟时间约为其四分之一。

## 循环赛逐对结果 {-}

表 @tab:bpairs 是循环赛 28 对智能体的逐对结果，是表 @tab:crosstab 与 Elo 拟合（表 @tab:elo）的原始数据。“A 执白时得分”指 A 执白的 16 局中 A 的得分。

::tab bpairs | 循环赛逐对结果（每对 32 局）

::include tables/B_pairs.md

## 各开局的统计 {-}

::tab bopenings | 16 个实验开局在主实验中的结果（全部 2144 局）

::include tables/B_openings.md

::note 注：每个开局在每组对阵中都使用两次（双方各执白一次），因此各开局的对局数相同。白方胜率在开局之间的差异，反映了开局本身的倾向与 1 秒 α-β“均衡”判断的误差。

## 修复分隔判定前后的循环赛 Elo {-}

表 @tab:bv1 对比第一版程序（分隔判定有漏洞，见 5.10.1 节）与修复后程序的循环赛 Elo。两版使用相同的智能体、开局与对局设计。第一版的数据只用于这一对比与 5.10.1 节的失败案例分析，正文其余结论全部基于修复后的数据。

::tab bv1 | 第一版与修复后程序的循环赛 Elo（200 ms/步，相对一步贪心）

::include tables/B_v1.md

## 自对弈数据 {-}

::tab bselfplay | 学习数据（自对弈）的概况

::include tables/B_selfplay.md

## 数据文件清单 {-}

::tab bfiles | 提交的原始数据文件

::include tables/B_files.md
