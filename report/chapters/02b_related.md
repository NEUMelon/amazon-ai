## 相关研究综述

本节按主题梳理与本项目相关的研究。为了避免“只列文献不做比较”，每一小节最后都说明这些工作与本文的关系。文献的选择以“与亚马逊棋 AI 的搜索、学习、评价直接相关”为原则；对于更一般的人工智能背景，读者可参考教材[@russell2020; @nilsson1980; @yannakakis2018; @millington2019]与综述[@yannakakis2015; @cr_marsland1991_309; @cr_iida1994_315]。

### 博弈树搜索与 α-β 的增强

**基础与理论。** 博弈树搜索的基础是 von Neumann 的极小极大定理[@neumann1928; @neumann1944]与 Shannon 的下棋程序设计[@shannon1950]。α-β 剪枝的早期历史与分析见 Knuth 与 Moore 的经典论文[@knuth1975]，其平均情形的效率由 Pearl 给出[@pearl1980; @pearl1982]，Marsland 等人对剪枝技术与相对效率做了系统比较[@marsland1986; @cr_marsland1982_294; @campbell1983]。关于极小极大本身是否“有益”，存在著名的“病态”（pathology）问题：在某些随机树模型中，搜索越深反而决策越差[@cr_beal1982_630; @cr_sadikov2005_650; @cr_mutchler1993_519]；Sadikov 等人用国际象棋残局实证考察了搜索与知识的关系[@cr_sadikov2004_649]，Althöfer 构造了对 α-β 特别容易的博弈树[@cr_althfer1991_517]。Michie 从信息论角度讨论了国际象棋的复杂性[@cr_michie1982_353]，Thompson 研究了计算机国际象棋棋力与搜索深度的关系[@cr_thompson1982_350]。

**α-β 的增强。** 迭代加深的思想来自 CHESS 4.5[@slate1977]，Korf 给出了一般的深度优先迭代加深分析[@korf1985]，Fink 提出了迭代 α-β 的改进[@cr_fink1982_293]。着法排序方面有杀手启发[@akl1977]、历史启发[@schaeffer1989]，以及基于模式与着法影响的排序方案[@cr_greer1999_663; @cr_greer2000_664]和“守卫启发”[@cr_ke1993_313]。窗口技术方面有 Scout/NegaScout[@reinefeld1983]与基于零窗口的 MTD(f)[@plaat1996]，de Bruin 等人以“解树”为基础统一了这些方法[@cr_debruin1994_316]。置换表方面，Zobrist 哈希[@zobrist1990]、替换策略[@breuker1994]、多次探测[@cr_beal1996_828]、利用置换表“从经验中学习”[@cr_slate1987_827]、在随机博弈树中的使用[@cr_veness2007_522]，以及并行搜索中的无锁实现[@hyatt2002]都有专门研究。

**选择性搜索。** 为了让搜索把时间花在关键变化上，人们提出了静态搜索[@beal1990; @cr_schrfer1989_261; @cr_beal1984_698]、单一着法延伸[@anantharaman1990]、空着裁剪及其变体[@cr_donninger1993_314; @cr_goetsch1990_662; @cr_heinz1999_667; @cr_tabibi2002_669]、Futility 剪枝等前向剪枝方法（Hoki 与 Muramatsu 比较了它们在将棋中的效率[@cr_hoki2012_672]），以及基于实现概率的搜索[@cr_tsuruoka2002_323]。另一条路线是放弃固定深度，采用最佳优先的方法：启发式最佳优先搜索 A*[@hart1968]在博弈中的对应物 B* 算法[@berliner1979]、SSS*[@stockman1979]、阴谋数搜索[@mcallester1988; @cr_mcallester2002_324]、极小极大近似[@cr_rivest1987_513]、最佳优先极小极大[@cr_korf1996_643]、偏序界[@cr_mller2001_520]等。Junghanns 讨论了这些方法能否真正替代 α-β[@cr_junghanns1998_320]，Mańdziuk 研究了实值评估函数下的 α-β 增强[@cr_madziuk2004_325]。Adelson-Velsky 等人很早就讨论了控制搜索的多种方法[@cr_adelsonvelsk1975_512]，Ballard 将极小极大推广到含机会结点的树[@cr_ballard1983_631]。

**并行与系统。** 并行博弈树搜索有大量研究[@marsland1985; @cr_hyatt1988_299; @cr_newborn1988_610; @cr_brockington1996_318]。工程上最具代表性的是 Deep Blue：它使用专用芯片和大规模并行 α-β 搜索[@campbell2002; @hsu1999]。Chinook 结合深度搜索、开局库与残局库成为跳棋世界冠军级程序，并最终证明了跳棋是和棋[@schaeffer1992; @schaeffer2007]，其中残局库依赖逆向分析[@thompson1986]。国际象棋程序的发展史与入门介绍可见文献[@cr_newborn1975_343; @cr_heinz2000_371; @cr_turing1988_359; @cr_marsland1989_301]，关于搜索深度与棋力关系的实证研究见文献[@ferreira2013; @heinz2001]。

**与本文的关系。** 本文的 α-β 采用其中最成熟的一组技术（迭代加深、PVS、置换表、杀手、历史），再加上激进的束宽剪枝，没有实现空着裁剪、静态搜索等国际象棋特有的技术：亚马逊棋没有“吃子”，局面不存在明显的“不稳定”状态，静态搜索的必要性不大；空着裁剪则与束宽剪枝的作用重叠。本文的贡献不在于提出新的增强，而在于在亚马逊棋上逐一测量这些增强的实际作用（5.4、5.9 节）。

### 证明数搜索与博弈求解

证明数搜索由 Allis 等人提出[@allis1994pn]，并与威胁空间搜索一起用于求解五子棋[@allis1996]。Kishimoto 等人的综述总结了它在头二十年的发展[@kishimoto2012]；van den Herik 与 Winands 也对 PNS 及其变体做了综述[@cr_vandenherik2008_682]。在算法层面，研究者提出了两层 PNS[@winands2004]、PN* 与深度优先 df-pn[@seo2001]、处理置换的方法[@cr_schijf1994_679]、解决“图历史交互”（GHI）问题的方法[@cr_kishimoto2005_680]、关于 df-pn 完备性的分析[@cr_kishimoto2008_464]、处理无限循环与估计偏差的技术[@cr_kishimoto2010_685]、新的证明数计算方法[@cr_yoshizoe2008_681]、减少“跷跷板效应”的深度证明数搜索[@cr_ishitobi2015_689]、并行 df-pn[@cr_kaneko2010_684; @pawlewicz2014]以及基于概率的证明数搜索[@cr_primanita2020_693]。Gao 等人用卷积神经网络为 df-pn 提供启发[@cr_gao2017_690]。在应用方面，PNS 被用于求解 Breakthrough[@saffidine2012]等游戏；PNS 与 MCTS 的结合也是近年的研究热点：蒙特卡洛证明数搜索[@cr_saito2007_401]、MCTS 与 PNS 的组合[@cr_doe2022_694]、基于证明数的 MCTS[@cr_kowalski2025_696]。威胁空间搜索方面，λ 搜索把“威胁的阶数”形式化[@thomsen2000]，抽象证明搜索利用目标相关着法缩小搜索空间[@cazenave2001]。

在亚马逊棋中，“求解”主要发生在分隔后的残局：每个区域都是一个单人或双人的小游戏，可以用组合博弈论把整个局面分解为若干子游戏的和[@berlekamp2001; @berlekamp2000amz]。Kloetzer 等人比较了多种残局求解器（包括 PNS 与基于组合博弈论的方法）[@kloetzer2008]，Song 与 Müller 提出了增强的残局求解器[@cr_song2015_54]，Snatzke 则在小棋盘上做了穷举[@snatzke2004]。

**与本文的关系。** 本文没有实现 PNS 或残局求解器。分隔后的局面由一个简单的贪心填格策略处理（2.6 节），这是本文的一个明确简化。

### 蒙特卡洛树搜索及其改进

**起源与理论。** MCTS 的思想来源包括期望结果模型[@abramson1990]、在线策略改进[@tesauro1996]、稀疏采样规划[@kearns2002]和蒙特卡洛围棋[@bouzy2004]。Coulom 的“选择性与回传算子”[@coulom2007]和 Kocsis 与 Szepesvári 的 UCT[@kocsis2006]标志着现代 MCTS 的诞生，其理论基础是多臂老虎机[@robbins1952; @lai1985; @auer2002; @bubeck2012; @lattimore2020]。Rosin 提出带上下文先验的老虎机算法[@rosin2011]，成为 PUCT 的理论来源；Silver 与 Veness 把 MCTS 推广到部分可观测环境[@silver2010]；Vodopivec 等人讨论了 MCTS 与强化学习的关系[@cr_vodopivec2017_539]，Grill 等人把 AlphaZero 式的 MCTS 解释为正则化的策略优化[@grill2020]。教程与分类可见文献[@cr_fu2018_253; @cr_mcguinness2016_252]。

**在围棋中的发展。** MCTS 在围棋中经历了大量改进：结合离线与在线知识[@gelly2007]、RAVE[@gelly2011]、渐进策略[@chaslot2008]、专家知识与探索[@cr_chaslot2010_138]、交叉熵调参[@cr_chaslot2008_327]、上下文模式[@cr_rimmel2010_136]、“共同命运图”模式[@cr_graf2014_166]、动态贴目[@cr_baudi2011_98]、时间管理[@cr_baier2012_405; @cr_baier2016_188]等，Gelly 等人的综述[@gelly2012]和 Fuego 等开源框架[@enzenberger2010]总结了这一阶段的成果。也有研究分析了模拟本身[@cr_fernando2014_175]、MCTS 在围棋中的局限[@cr_huang2014_174]、静态知识偏置的效率[@cr_ikeda2014_173]、激励学习[@cr_kao2013_162]以及 MCTS 在围棋中的评价[@cr_takeuchi2008_129; @cr_chen2009_403]。在深度学习时代，卷积网络被引入 MCTS[@cr_graf2016_195; @tian2016]，并最终发展为 AlphaGo[@silver2016]。

**选择公式与探索。** 除了 UCT 和 PUCT，研究者还提出了改进的 UCB[@cr_liu2015_830; @cr_liu2016_832]、面向“简单遗憾”的探索调节[@cr_liu2015_179]、多臂老虎机探索的改进[@cr_gray2023_232]、新颖性奖励[@cr_baier2025_241]，以及用进化或蒙特卡洛搜索自动发现探索项的方法[@cr_galvn2023_834; @cr_cazenave2025_245; @cr_cazenave2026_263]。参数的随机化与自适应在一般博弈中也有研究[@cr_sironi2019_212; @cr_sironi2020_217; @cr_sironi2021_542]，RAVE 的各种变体在一般博弈中被比较[@cr_sironi2016_721]。

**模拟策略。** 模拟策略的设计影响巨大：在线学习模拟策略[@silver2012; @cr_graf2015_186; @cr_graf2016_199]、学习非随机着法[@cr_robles2011_144]、模拟策略自适应[@cr_sironi2021_676]、模拟优化[@cr_buzer2021_675]等。Teytaud 指出决定性着法规则带来巨大收益[@teytaud2010]。

**树结构与并行。** 置换与着法分组[@cr_childs2008_128; @cr_vaneyck2012_158]、分数有界 MCTS[@cr_cazenave2011_149]、祖先 α-β 界[@cr_pepels2024_238]、批量 MCTS[@cr_cazenave2023_235]、束 MCTS[@cr_baier2012_154]等改进了树的组织方式。并行化方面有根并行、树并行与虚拟损失[@chaslot2008par; @cr_cazenave2008_130; @cr_enzenberger2010_134; @cr_mirsoleimani2017_104; @cr_steinmetz2021_222]以及分布式 MCTS[@cr_schaefers2015_177]。

**在其他游戏中的应用。** MCTS 已被用于 Hex[@arneson2010]、Lines of Action[@cr_winands2010_132]、亚马逊棋（2.8.6 节）、“突然死亡”类游戏[@cr_chen2019_332]、一般博弈[@cr_finnsson2021_541; @cr_mehat2010_133]、不完全信息博弈[@cr_cowling2012_151; @cr_long2010_525]、实时策略游戏[@cr_uriarte2014_534]，也被用于评估玩家策略的复杂性[@cr_lanzi2019_110]。Berthier 等人讨论了自动调参 MCTS 的一致性问题[@cr_berthier2010_137]。综述[@browne2012; @swiechowski2023]对此有全面总结。

**与本文的关系。** 本文实现的 MCTS 吸收了其中的几项关键思想：渐进展开、PUCT 先验、评估截断模拟与一步制胜检查。没有实现 RAVE：亚马逊棋的着法由“移后 + 射箭”组成，同一着法在不同局面中几乎不会重复出现，“所有着法同时更新”的统计量很难积累（2.9 节）。

### MCTS 与极小极大的混合

由于 MCTS 在“陷阱”多的游戏中表现不佳[@ramanujan2010; @ramanujan2011]，许多研究尝试把极小极大搜索的优势引入 MCTS：MCTS-Solver 在树内传播胜负证明[@winands2008]；隐式极小极大回传把评估函数值与模拟结果结合起来[@lanctot2014]；Baier 与 Winands 系统研究了在选择、扩展、模拟各阶段嵌入浅层极小极大搜索的混合方案[@baier2013; @baier2015]；Winands 与 Björnsson 在模拟中使用 α-β[@cr_winands2011_143]；Lorentz 讨论了评估函数在 MCTS 中的用法[@cr_lorentz2016_196]；Matsuzaki 实证检验了评估函数是否真正改进 MCTS[@cr_matsuzaki2019_331]；Winands 等人把基于评估函数的 MCTS 用于 Lines of Action[@cr_winands2010_472]。

**与本文的关系。** 本文的 MCTS 以“评估截断”的方式使用评估函数，属于其中最常见的一类；没有实现隐式极小极大回传或在模拟中嵌入 α-β。国内也有在亚马逊棋上把 UCT 与 PVS 结合的尝试[@li2021amz; @li2014amz]。5.3 与 5.6 节在相同知识、相同时间下直接比较了两类框架。

### 机器学习与深度强化学习在博弈中的应用

**早期学习方法。** Samuel 的跳棋程序[@samuel1959; @samuel1967]开创了“从对局中学习评估函数”的方向。此后有时间差分学习[@sutton1988; @tesauro1994; @tesauro1995; @schraudolph1994; @thrun1995]、比较训练[@tesauro1989]、统计特征组合[@buro1995; @buro1999; @buro2002]、自举学习[@veness2009]、大规模优化[@hoki2014]等。Fürnkranz[@furnkranz1996]和 Mańdziuk[@mandziuk2010]分别综述了国际象棋中的机器学习和“无知识/基于学习”的博弈方法。Lucas 与 Runarsson 比较了时间差分学习与协同进化[@lucas2006]，Szubert 与 Jaśkowski 在 2048 中使用 n 元组网络[@szubert2014]。

**走子预测。** 在围棋中，从棋谱学习走子模型的方法包括 Bayes 模式排序[@stern2006]、着法模式 Elo[@coulom2007elo]、最大熵模型[@araki2007]，以及后来的深度卷积网络[@maddison2015; @clark2015; @tian2016]。本文的线性策略正是这一路线在亚马逊棋上的轻量版本。

**深度强化学习。** DQN 在 Atari 游戏上达到人类水平[@mnih2015]，相关评测平台包括 ALE[@bellemare2013; @machado2018]、Gym[@brockman2016]、OpenSpiel[@lanctot2019]与 GVGAI[@perezliebana2016]。在棋类中，AlphaGo 结合策略网络、价值网络与 MCTS 击败了人类顶尖棋手[@silver2016]；AlphaGo Zero 和 AlphaZero 完全通过自对弈学习[@silver2017; @silver2017arxiv; @silver2018]；Anthony 等人同时提出了“专家迭代”[@anthony2017]；MuZero 进一步学习环境模型[@schrittwieser2020]，并被扩展到复杂动作空间[@hubert2021]。开源复现包括 ELF OpenGo[@tian2019]与 KataGo[@wu2019]。DeepChess[@david2016]、Giraffe[@lai2015]等则用深度学习改进国际象棋评估。强化学习的一般理论见 Sutton 与 Barto 的教材[@sutton2018]，常用算法包括 Q 学习[@watkins1992]、REINFORCE[@williams1992]与 PPO[@schulman2017]，Silver 等人更提出“奖励即足够”的观点[@silver2021]。

**更广泛的博弈 AI。** 深度强化学习与搜索的结合也被用于扑克[@moravcik2017; @brown2018; @brown2019]、星际争霸 II[@vinyals2019]、Dota 2[@berner2019]、外交[@bakhtin2022]、西洋陆军棋[@perolat2022]，以及统一完全与不完全信息的“Student of Games”[@schmid2023]；同样的“搜索 + 学习”范式还被用于发现矩阵乘法与排序算法[@fawzi2022; @mankowitz2023]。

**AlphaZero 的改进与分析。** 针对 AlphaZero，研究者提出了多种效率改进[@cr_clausen2021_10; @cr_scheiermann2023_22; @cr_demura2024_29; @cr_cheng2025_38]、替代损失函数[@cr_wang2019_3]、超参数作为搜索偏置的分析[@cr_weiner2021_12]、在非确定性游戏中的应用[@cr_hsueh2018_1]、在四子棋上的实现[@cr_guo2024_30]、“精确胜利策略”[@cr_chen2018_2]，以及神经缩放规律[@cr_neumann2025_39]。自对弈本身也有专门的综述与研究[@cr_plaat2020_730; @cr_plaat2022_736; @cr_vanderree2013_729; @cr_neumann2022_737]。概念层面的分析表明，AlphaZero 内部确实习得了人类可理解的棋类知识[@mcgrath2022; @cr_lovering2022_16; @cr_tomaev2022_14]。然而，超人类水平的程序也并非无懈可击：对抗策略可以击败超人类围棋 AI[@wang2023adv]，AlphaZero 式智能体对对抗扰动也不鲁棒[@lan2022]。

**缩放规律。** 近年的研究开始系统地测量“计算量—棋力”关系：Jones 在棋盘游戏上研究了训练与测试计算之间的权衡[@jones2021]；Neumann 与 Gros 研究了多智能体强化学习模型的缩放规律[@neumann2022]；语言模型的缩放规律[@kaplan2020]和测试时计算缩放[@snell2024; @brown2024monkeys]也引起了广泛关注；也有工作研究用大规模 Transformer 进行“摊销规划”[@ruoss2024]，或让语言模型通过内外部规划下棋[@schultz2024]。早期的国际象棋研究同样观察到搜索深度增加带来的“收益递减”[@heinz2001; @ferreira2013]。

**与本文的关系。** 本文的学习组件在规模上与 AlphaZero 不可同日而语，属于“特征工程 + 线性模型”的经典路线。5.6 节的算力缩放实验在小尺度上呼应了缩放规律研究的问题：在固定算法下，增加思考时间能换来多少棋力？

### 亚马逊棋的理论与程序

**组合博弈论与复杂性。** 亚马逊棋的残局是组合博弈论的经典研究对象。Berlekamp 等人的《Winning Ways》奠定了“游戏的和”的理论基础[@berlekamp2001]，Berlekamp 分析了 N×2 窄棋盘上亚马逊棋的和[@berlekamp2000amz]，Snatzke 用穷举得到了小棋盘上的新结果[@snatzke2004]。复杂性方面，Buro 证明了一类简单亚马逊棋残局与三次子网格图上哈密顿回路问题的联系，说明残局判定是 NP 完全的[@buro2001amz]；Hearn 证明了广义亚马逊棋、Konane 与 Cross Purposes 都是 PSPACE 完全的[@hearn2009amz]，Hearn 与 Demaine 在专著中系统总结了这类结果[@hearn2009]。类似的结论还有广义五子棋[@reisch1980]、广义围棋[@lichtenstein1980]、黑白棋[@iwata1994]、广义国际象棋[@fraenkel1981]以及一般的两人完全信息博弈[@schaefer1978; @stockmeyer1979]。与亚马逊棋同属“组合博弈论友好”的游戏还有 Konane[@uiterwijk2022konane]、Clobber[@althofer2002clobber; @demaine2004clobber; @uiterwijk2017clobber]与 Domineering 等，它们常被用来检验“组合博弈论 + 搜索”的结合方法。

**评估与 α-β 程序。** Müller 与 Tegos 的实验研究是计算机亚马逊棋的早期代表，系统比较了多种评估特征与搜索技术[@muller2002amz]；Avetisyan 与 Lorentz 研究了亚马逊棋中的选择性搜索[@avetisyan2003]；Lieberum 提出的“后距离 + 王距离 + 阶段权重”评估函数成为后来大多数程序的基础[@cr_lieberum2005_45; @lieberum2004]。Iida 与 Müller 报告了早期的计算机亚马逊棋锦标赛[@iida2000amz]。国内的亚马逊棋研究多与全国大学生计算机博弈大赛相关，主要发表在中国控制与决策会议等会议上，内容包括搜索算法的分析与改进[@guo2011amz; @hongkun2014amz; @yuan2014amz; @guo2019amz]、区域划分搜索[@hongxia2013amz]、评估函数的优化（包括粒子群与并行遗传算法调参）[@zhong2014amz; @chai2019amz; @qiu2023amz]、基于 PVS 的并行优化与开局库[@wang2021amz; @ju2021amz]。

**MCTS 程序。** Lorentz 在 2008 年报告，他的亚马逊棋程序改用“蒙特卡洛模拟 + 评估截断”后胜过了原来的 α-β 版本[@lorentz2008amz]，后来又系统讨论了“提前终止模拟”与评估函数在 MCTS 中的用法[@lorentz2015ept; @cr_lorentz2016_196]。Kloetzer 等人研究了 MCTS 的亚马逊棋开局库[@kloetzer2011]。Kato 等人分析了 MCTS 在变体“骑士亚马逊棋”上的表现[@kato2015amz]。国内工作包括 UCT 算法在亚马逊棋人机对弈中的应用[@li2014amz]、UCT 与 PVS 的混合[@li2021amz]、ε-贪心 MCTS[@tian2023amz]、MCTS 的效率优化[@cr_zhang2024_60]以及 MCTS 与评估函数的 GPU 加速[@sun2022amz]；Sun 等人对亚马逊棋的博弈算法做了综述[@sun2023amz]。

**学习方法。** 用神经网络和强化学习下亚马逊棋的尝试包括：神经网络结合分布式计算[@chang2018amz]、基于强化学习的对弈系统与评估函数设计[@meng2019amz; @jianbo2019amz]、强化学习的应用[@huang2019amz]。这些工作的规模都远小于 AlphaZero，报告的棋力也多以与课程或比赛程序的对局为准。

**与本文的关系。** 本文的领地评估直接采用 Lieberum 的特征[@cr_lieberum2005_45]，评估截断的 MCTS 沿用 Lorentz 等人的做法[@lorentz2008amz]，束宽剪枝与 Avetisyan 等人的选择性搜索[@avetisyan2003]、国内程序的常见做法一致。与这些工作不同的是：（1）本文在**同一知识层、同一时间预算、同一填格策略**下对两类框架做了系统比较，而不是各自报告与不同对手的结果；（2）报告了细粒度消融、缩放与置信区间；（3）提供了可解释的网页界面。本文的程序没有开局库、残局求解器与并行搜索，在绝对棋力上很可能弱于这些比赛程序，这一点在 5.11 节中说明。

### 其他棋类中的评估与学习

评估函数的构造与学习在许多棋类中都有研究，可以为亚马逊棋提供借鉴。黑白棋中有神经网络评估[@cr_abdelbar1998_273]、小型网络的时间差分学习[@cr_manning2007_275]、基于胜率的时间差分学习[@cr_osaki2008_277]、前瞻深度对学习的影响[@cr_runarsson2007_276]、资源受限纳什记忆[@cr_manning2010_280]、偏好学习[@cr_runarsson2014_283]，以及对固定对手学习与自对弈学习的比较[@cr_vanderree2013_729]。将棋中有基于棋谱的评估学习[@cr_tanimoto2004_772]、自对弈学习[@cr_yamamoto2001_763]、均匀性正则网络与多任务学习[@cr_wan2018_797; @cr_wan2018_800]、小规模深度学习压缩评估函数[@cr_yamana2026_291]，Iida 等人综述了计算机将棋[@cr_iida2002_770]，Takeuchi 等人估计了程序等级分并比较了不同棋类的搜索行为[@cr_takeuchi2015_790; @cr_takeuchi2022_803]。国际象棋中有序相关调参[@cr_gomboc2004_468]、差分进化与进化算法调参[@cr_boskovicNone_466; @cr_kendallNone_467; @cr_vazquezferna2011_475]。中国象棋中有混合评估函数[@cr_tingtingfu2012_382]，Yen 等人综述了计算机中国象棋[@cr_yen2004_373]。Lines of Action[@cr_winands2004_470]、四子棋[@cr_runarsson2015_481; @cr_tour2023_659]中同样有评估函数设计的研究，Chang 等人用残局库验证与微调评估函数[@cr_chang2018_482]。Hex 中有死点分析[@cr_bjrnsson2006_500]、虚连接与局面化简[@cr_hayward2004_498]、作业级 UCT 求解开局[@cr_liang2015_506]，Gale 证明了 Hex 与 Brouwer 不动点定理的联系[@cr_gale1979_490]。一般博弈（GGP）中的评估函数自动构造[@cr_clune2011_551; @cr_waledzik2014_479]、策略自适应[@cr_swiechowski2014_557]与国际 GGP 比赛[@cr_genesereth2013_552]，则代表了“不依赖特定游戏知识”的方向。

**与本文的关系。** 本文的 Texel 调参属于“从对局结果拟合线性评估”的路线，与 Buro、Hoki 等人的方法同源；5.7 节同时用离线交叉熵与对局结果评价学到的权重，并讨论两者之间的关系（参见“评估精度与搜索棋力之间并非单调关系”的已有观察[@cr_gomboc2004_468; @cr_matsuzaki2019_331]）。

### 评价方法与可复现性

**等级分。** Elo 体系[@elo1978]及其统计基础 Bradley–Terry 模型[@bradley1952]、Luce 选择公理[@luce1959]和 Plackett–Luce 模型[@plackett1975]是对局评价的基础。Hunter 给出了广义 Bradley–Terry 模型的 MM 算法[@hunter2004]，Glickman 处理了动态配对比较[@glickman1999]，Coulom 提出了“全历史等级分”[@coulom2008]，Herbrich 等人提出了 TrueSkill[@herbrich2007]。也有研究用等级分刻画局部模式[@cr_li2011_63]。统计方法方面，本文用到了 Wilson 区间[@wilson1927; @agresti1998; @clopper1934]和自助法[@efron1979; @efron1993]。

**实验方法与可复现性。** Cohen 的《人工智能的经验方法》[@cohen1995]系统讨论了 AI 实验设计。Henderson 等人[@henderson2018]和 Agarwal 等人[@agarwal2021]指出深度强化学习实验中普遍存在的统计问题，Demšar 讨论了多数据集上的统计比较[@demsar2006]，Lipton 与 Steinhardt 批评了机器学习文献中的不良趋势[@lipton2019]。可复现性方面，Gundersen 与 Kjensmo 调查了 AI 研究的可复现性现状[@gundersen2018]，Pineau 等人报告了 NeurIPS 可复现性计划[@pineau2021]，Peng[@peng2011]、Sandve 等人[@sandve2013]与 Wilson 等人[@wilson2014]给出了计算研究可复现的实践建议。

**与本文的关系。** 本文遵循这些建议：所有实验由脚本生成、固定随机种子、报告置信区间与效应量、明确说明哪些比较不显著。

### 可解释性、人机交互与可视化

博弈 AI 的可解释性既包括理解模型学到了什么[@mcgrath2022; @hohman2019]，也包括解释单个决策（例如用特征显著性解释智能体的着法[@puri2020]）。人机交互方面，Amershi 等人提出了人机交互设计准则[@amershi2019]，Shneiderman 提出“以人为中心的 AI”[@shneiderman2020]；McIlroy-Young 等人研究如何让超人类 AI 与人类行为对齐[@mcilroy2020]，Shin 等人发现超人类 AI 促使人类棋手做出更具新意的决策[@shin2023]。可视化设计方面，本文参考了图形感知[@cleveland1984; @heer2010]与可视化分析设计[@munzner2014]的研究来设计界面中的热力图与图表。

**与本文的关系。** 本文的网页界面把“AI 为什么这样走”拆解为领地图、候选着法与搜索统计、主变例三个层次，属于“局部解释”的朴素实现；它主要服务于课程演示与教学，而不是严格意义上的可解释性研究。

### 本文的定位

综上，本文所用算法均来自已有研究，本文的定位是：**在一个可控、可复现的统一框架中，对亚马逊棋上的经典搜索与轻量学习方法做系统的实证比较，并把算法的决策过程以可交互的方式呈现出来**。表 @tab:position 从几个维度把本文与代表性工作做了对比。

::tab position | 本文与代表性相关工作的比较

| 工作 | 游戏 | 搜索方法 | 学习 | 多算法统一比较 | 可交互界面 |
|---|---|---|---|---|---|
| Müller 与 Tegos[@muller2002amz] | 亚马逊棋 | α-β | 无 | 部分（评估特征比较） | 否 |
| Lieberum[@cr_lieberum2005_45] | 亚马逊棋 | α-β | 无 | 否（评估函数设计） | 否 |
| Lorentz[@lorentz2008amz] | 亚马逊棋 | MCTS + 评估截断 | 无 | α-β 与 MCTS 两个版本 | 否 |
| Kloetzer 等[@kloetzer2011] | 亚马逊棋 | MCTS | 无（开局库） | — | 否 |
| Baier 与 Winands[@baier2015] | 多种棋类 | MCTS–极小极大混合 | 无 | 是 | — |
| Li 等[@li2021amz] | 亚马逊棋 | UCT–PVS 混合 | 无 | — | — |
| Zhang 等[@cr_zhang2024_60] | 亚马逊棋 | MCTS 优化 | — | — | — |
| **本文** | 亚马逊棋 | α-β、6 种 MCTS | 线性策略、Texel | 是（8 个智能体循环赛 + 24 组消融） | 是 |
