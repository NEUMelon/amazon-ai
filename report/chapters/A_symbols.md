# 附录A　符号与术语

::tab symbols | 主要符号

| 符号 | 含义 | 首次出现 |
|---|---|---|
| $s$、$\mathcal{S}$ | 局面、局面集合 | 1.2.2 |
| $\rho(s)$、$\bar\rho$ | 行棋方、对手 | 1.2.2 |
| $A(s)$、$T(s,a)$ | 合法着法集合、转移函数 | 1.2.2 |
| $V(s)$ | 博弈论值（行棋方视角） | 式 @eq:negamax |
| $(f,t,a)$ | 一个着法：后从 $f$ 走到 $t$，再向 $a$ 射箭 | 2.2.1 |
| $D^Q_p(x)$、$D^K_p(x)$ | 玩家 $p$ 的后到达格子 $x$ 的后距离、王距离 | 2.2.2 |
| $t_1$、$t_2$ | 按后距离、王距离统计的领地差 | 式 @eq:t1 |
| $c_1$、$c_2$ | 按后距离、王距离计算的位置项 | 式 @eq:c1 |
| $\kappa$ | 双方同时到达的格子给行棋方的分数（0.2） | 2.2.3 |
| $w$、$p$、$W_0$ | 争夺程度、阶段系数 $p=\min(1,w/W_0)$、$W_0=60$ | 式 @eq:w |
| $\mathrm{mob}$、$m_q$ | 移动性特征、后 $q$ 的可走步数 | 式 @eq:mob |
| $a^{\text{E}}_k$、$a^{\text{L}}_k$ | 评估函数中特征 $k$ 的开局、后期权重 | 式 @eq:eval |
| $E(s)$ | 静态评估函数（行棋方视角，单位约为“格”） | 式 @eq:eval |
| $R_p$、$\delta$ | 分隔后玩家 $p$ 可达的空格数、区域格数差 | 式 @eq:sep |
| $Q(f,t)$、$A(a)$ | 可分离评估的“移后”项与“射箭”项 | 式 @eq:sep2 |
| $D$、$b$ | 搜索深度、分支因子 | 式 @eq:knuth |
| $\alpha$、$\beta$ | α-β 搜索窗口的下界与上界 | 2.3.1 |
| $W$、$P$ | 内部结点束宽（8）、叶前结点候选数（24） | 2.3.5 |
| $N(s)$、$N(s,a)$ | MCTS 访问次数 | 式 @eq:uct |
| $\bar Q(s,a)$ | MCTS 平均收益 | 式 @eq:uct |
| $c$、$c_{\text{puct}}$ | UCT（0.5）、PUCT（1.5）探索常数 | 式 @eq:uct、@eq:puct |
| $C_{\text{pw}}$、$\alpha$ | 渐进展开的系数（2）与指数（0.5） | 式 @eq:pw |
| $P(s,a)$、$\tau$ | 先验概率、先验的 softmax 温度（4） | 式 @eq:puct |
| $L$、$k$ | 截断模拟的随机步数（4）、评估值到胜率的尺度（0.18） | 式 @eq:sigmoid |
| $\phi(x,m)$、$\theta$ | 走子策略的 12 维着法特征与参数 | 式 @eq:softmax |
| $K$、$\mathbf{a}$ | Texel 调参中的尺度与 10 维评估权重 | 式 @eq:texel |
| $R_i$、$\Delta R$ | Elo 等级分、等级分差 | 式 @eq:elo、@eq:elodiff |

::tab terms | 主要术语与缩写

| 术语/缩写 | 全称或英文 | 含义 |
|---|---|---|
| 后、箭 | amazon (queen), arrow | 亚马逊棋的棋子与障碍物 |
| 分隔 | separation | 双方的后不再共享任何可达空格，对局分解为互不影响的区域 |
| 填格 | filling | 分隔后在己方区域内逐步走完空格的阶段 |
| 后距离 / 王距离 | queen / king distance | 按后的走法 / 王的走法到达某格的最少步数 |
| 可分离评估 | separable evaluation | 把“移后”与“射箭”分别评估再相加的着法排序方法（本文设计） |
| PV | Principal Variation | 主变例，搜索认为双方最佳的着法序列 |
| PVS | Principal Variation Search | 主变例搜索（NegaScout） |
| TT | Transposition Table | 置换表 |
| MCTS | Monte Carlo Tree Search | 蒙特卡洛树搜索 |
| UCT | Upper Confidence bounds applied to Trees | 基于 UCB1 的树搜索 |
| PUCT | Predictor + UCT | 带先验的 UCT 变体 |
| PW | Progressive Widening | 渐进展开 |
| EBF | Effective Branching Factor | 有效分支因子 |
| Elo | — | 等级分体系 |
| NLL | Negative Log-Likelihood | 负对数似然（交叉熵） |
