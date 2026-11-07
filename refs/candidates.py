# 参考文献候选清单（作者凭记忆列出的标题、第一作者与年份）。
# 每一条都必须经 refs/verify.py 在 Crossref / arXiv / OpenLibrary 上找到匹配记录，
# 元数据（作者全名、期刊、卷期页码、DOI）一律以检索结果为准，而不是以这里的记忆为准。
# 字段：key, 类型(j=期刊/会议, a=arXiv, b=图书, w=网页), 第一作者姓, 年份, 标题, 主题
C = r"""
shannon1950|j|Shannon|1950|Programming a computer for playing chess|search
turing1953|b|Turing|1953|Digital computers applied to games|search
neumann1928|j|Neumann|1928|Zur Theorie der Gesellschaftsspiele|theory
neumann1944|b|Neumann|1944|Theory of Games and Economic Behavior|theory
knuth1975|j|Knuth|1975|An analysis of alpha-beta pruning|search
pearl1982|j|Pearl|1982|The solution for the branching factor of the alpha-beta pruning algorithm and its optimality|search
pearl1980|j|Pearl|1980|Asymptotic properties of minimax trees and game-searching procedures|search
stockman1979|j|Stockman|1979|A minimax algorithm better than alpha-beta?|search
campbell1983|j|Campbell|1983|A comparison of minimax tree search algorithms|search
marsland1986|j|Marsland|1986|A review of game-tree pruning|search
plaat1996|j|Plaat|1996|Best-first fixed-depth minimax algorithms|search
schaeffer1989|j|Schaeffer|1989|The history heuristic and alpha-beta search enhancements in practice|search
zobrist1990|j|Zobrist|1990|A new hashing method with application for game playing|search
beal1990|j|Beal|1990|A generalised quiescence search algorithm|search
anantharaman1990|j|Anantharaman|1990|Singular extensions: Adding selectivity to brute-force searching|search
berliner1979|j|Berliner|1979|The B* tree search algorithm: A best-first proof procedure|search
mcallester1988|j|McAllester|1988|Conspiracy numbers for min-max search|search
allis1994pn|j|Allis|1994|Proof-number search|threat
kishimoto2012|j|Kishimoto|2012|Game-tree search using proof numbers: The first twenty years|threat
campbell2002|j|Campbell|2002|Deep Blue|search
hsu1999|j|Hsu|1999|IBM's Deep Blue chess grandmaster chips|search
schaeffer2007|j|Schaeffer|2007|Checkers is solved|search
schaeffer1992|j|Schaeffer|1992|A world championship caliber checkers program|search
samuel1959|j|Samuel|1959|Some studies in machine learning using the game of checkers|learning
samuel1967|j|Samuel|1967|Some studies in machine learning using the game of checkers. II—Recent progress|learning
tesauro1995|j|Tesauro|1995|Temporal difference learning and TD-Gammon|learning
tesauro1994|j|Tesauro|1994|TD-Gammon, a self-teaching backgammon program, achieves master-level play|learning
korf1985|j|Korf|1985|Depth-first iterative-deepening: An optimal admissible tree search|search
hart1968|j|Hart|1968|A formal basis for the heuristic determination of minimum cost paths|search
newell1958|j|Newell|1958|Chess-playing programs and the problem of complexity|search
herik2002|j|Herik|2002|Games solved: Now and in the future|games
allis1996|j|Allis|1996|Go-Moku solved by new search techniques|gomoku
wagner2001|j|Wagner|2001|Solving renju|gomoku
wu2005|j|Wu|2005|A new family of k-in-a-row games|gomoku
wu2010|j|Wu|2010|Relevance-zone-oriented proof search for Connect6|gomoku
uiterwijk2000|j|Uiterwijk|2000|The advantage of the initiative|gomoku
arneson2010|j|Arneson|2010|Monte Carlo tree search in Hex|mcts
hales1963|j|Hales|1963|Regularity and positional games|theory
erdos1973|j|Erdős|1973|On a combinatorial game|theory
beck2008|b|Beck|2008|Combinatorial Games: Tic-Tac-Toe Theory|theory
reisch1980|j|Reisch|1980|Gobang ist PSPACE-vollständig|theory
hearn2009|b|Hearn|2009|Games, Puzzles, and Computation|theory
fraenkel1981|j|Fraenkel|1981|Computing a perfect strategy for n×n chess requires time exponential in n|theory
lichtenstein1980|j|Lichtenstein|1980|GO Is Polynomial-Space Hard|theory
stockmeyer1979|j|Stockmeyer|1979|Provably difficult combinatorial games|theory
schaefer1978|j|Schaefer|1978|On the complexity of some two-person perfect-information games|theory
iwata1994|j|Iwata|1994|The Othello game on an n×n board is PSPACE-complete|theory
abramson1990|j|Abramson|1990|Expected-outcome: a general model of static evaluation|mcts
bouzy2004|j|Bouzy|2004|Monte-Carlo Go Developments|mcts
coulom2007|j|Coulom|2007|Efficient Selectivity and Backup Operators in Monte-Carlo Tree Search|mcts
kocsis2006|j|Kocsis|2006|Bandit Based Monte-Carlo Planning|mcts
gelly2007|j|Gelly|2007|Combining online and offline knowledge in UCT|mcts
gelly2011|j|Gelly|2011|Monte-Carlo tree search and rapid action value estimation in computer Go|mcts
gelly2012|j|Gelly|2012|The grand challenge of computer Go|mcts
browne2012|j|Browne|2012|A Survey of Monte Carlo Tree Search Methods|mcts
chaslot2008|j|Chaslot|2008|Progressive strategies for Monte-Carlo tree search|mcts
chaslot2008par|j|Chaslot|2008|Parallel Monte-Carlo Tree Search|mcts
winands2008|j|Winands|2008|Monte-Carlo Tree Search Solver|mcts
coulom2007elo|j|Coulom|2007|Computing Elo Ratings of Move Patterns in the Game of Go|learning
rosin2011|j|Rosin|2011|Multi-armed bandits with episode context|mcts
auer2002|j|Auer|2002|Finite-time analysis of the multiarmed bandit problem|bandit
lai1985|j|Lai|1985|Asymptotically efficient adaptive allocation rules|bandit
robbins1952|j|Robbins|1952|Some aspects of the sequential design of experiments|bandit
bubeck2012|j|Bubeck|2012|Regret Analysis of Stochastic and Nonstochastic Multi-armed Bandit Problems|bandit
lattimore2020|b|Lattimore|2020|Bandit Algorithms|bandit
silver2010|j|Silver|2010|Monte-Carlo planning in large POMDPs|mcts
kearns2002|j|Kearns|2002|A sparse sampling algorithm for near-optimal planning in large Markov decision processes|mcts
cazenave2009|j|Cazenave|2009|Nested Monte-Carlo search|mcts
lanctot2014|j|Lanctot|2014|Monte Carlo Tree Search with heuristic evaluations using implicit minimax backups|hybrid
baier2015|j|Baier|2015|MCTS-Minimax Hybrids|hybrid
baier2013|j|Baier|2013|Monte-Carlo Tree Search and minimax hybrids|hybrid
ramanujan2010|j|Ramanujan|2010|On Adversarial Search Spaces and Sampling-Based Planning|hybrid
ramanujan2011|j|Ramanujan|2011|Trade-offs in sampling-based adversarial planning|hybrid
finnsson2008|j|Finnsson|2008|Simulation-based approach to general game playing|mcts
swiechowski2023|j|Świechowski|2023|Monte Carlo Tree Search: a review of recent modifications and applications|mcts
enzenberger2010|j|Enzenberger|2010|Fuego—An Open-Source Framework for Board Games and Go Engine Based on Monte Carlo Tree Search|mcts
silver2012|j|Silver|2012|Temporal-difference search in computer Go|learning
tesauro1996|j|Tesauro|1996|On-line policy improvement using Monte-Carlo search|mcts
teytaud2010|j|Teytaud|2010|On the huge benefit of decisive moves in Monte-Carlo Tree Search algorithms|mcts
silver2016|j|Silver|2016|Mastering the game of Go with deep neural networks and tree search|deeprl
silver2017|j|Silver|2017|Mastering the game of Go without human knowledge|deeprl
silver2018|j|Silver|2018|A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play|deeprl
silver2017arxiv|a|Silver|2017|Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm|deeprl
schrittwieser2020|j|Schrittwieser|2020|Mastering Atari, Go, chess and shogi by planning with a learned model|deeprl
anthony2017|j|Anthony|2017|Thinking Fast and Slow with Deep Learning and Tree Search|deeprl
tian2016|a|Tian|2015|Better Computer Go Player with Neural Network and Long-term Prediction|deeprl
tian2019|a|Tian|2019|ELF OpenGo: An Analysis and Open Reimplementation of AlphaZero|deeprl
wu2019|a|Wu|2019|Accelerating Self-Play Learning in Go|deeprl
clark2015|a|Clark|2014|Teaching Deep Convolutional Neural Networks to Play Go|deeprl
maddison2015|a|Maddison|2014|Move Evaluation in Go Using Deep Convolutional Neural Networks|deeprl
mnih2015|j|Mnih|2015|Human-level control through deep reinforcement learning|deeprl
sutton2018|b|Sutton|2018|Reinforcement Learning: An Introduction|rl
sutton1988|j|Sutton|1988|Learning to predict by the methods of temporal differences|rl
watkins1992|j|Watkins|1992|Q-learning|rl
williams1992|j|Williams|1992|Simple statistical gradient-following algorithms for connectionist reinforcement learning|rl
schulman2017|a|Schulman|2017|Proximal Policy Optimization Algorithms|rl
danihelka2022|j|Danihelka|2022|Policy improvement by planning with Gumbel|deeprl
grill2020|j|Grill|2020|Monte-Carlo Tree Search as Regularized Policy Optimization|deeprl
hubert2021|j|Hubert|2021|Learning and Planning in Complex Action Spaces|deeprl
antonoglou2022|j|Antonoglou|2022|Planning in Stochastic Environments with a Learned Model|deeprl
lai2015|a|Lai|2015|Giraffe: Using Deep Reinforcement Learning to Play Chess|learning
david2016|j|David|2016|DeepChess: End-to-End Deep Neural Network for Automatic Learning in Chess|learning
moravcik2017|j|Moravčík|2017|DeepStack: Expert-level artificial intelligence in heads-up no-limit poker|deeprl
brown2018|j|Brown|2018|Superhuman AI for heads-up no-limit poker: Libratus beats top professionals|deeprl
brown2019|j|Brown|2019|Superhuman AI for multiplayer poker|deeprl
vinyals2019|j|Vinyals|2019|Grandmaster level in StarCraft II using multi-agent reinforcement learning|deeprl
berner2019|a|Berner|2019|Dota 2 with Large Scale Deep Reinforcement Learning|deeprl
perolat2022|j|Perolat|2022|Mastering the game of Stratego with model-free multiagent reinforcement learning|deeprl
bakhtin2022|j|Bakhtin|2022|Human-level play in the game of Diplomacy by combining language models with strategic reasoning|deeprl
schmid2023|j|Schmid|2023|Student of Games: A unified learning algorithm for both perfect and imperfect information games|deeprl
fawzi2022|j|Fawzi|2022|Discovering faster matrix multiplication algorithms with reinforcement learning|deeprl
mankowitz2023|j|Mankowitz|2023|Faster sorting algorithms discovered using deep reinforcement learning|deeprl
silver2021|j|Silver|2021|Reward is enough|rl
baxter2000|j|Baxter|2000|Learning to Play Chess Using Temporal Differences|learning
veness2009|j|Veness|2009|Bootstrapping from Game Tree Search|learning
thrun1995|j|Thrun|1995|Learning to Play the Game of Chess|learning
schraudolph1994|j|Schraudolph|1994|Temporal Difference Learning of Position Evaluation in the Game of Go|learning
xie2018|a|Xie|2018|AlphaGomoku: An AlphaGo-based Gomoku Artificial Intelligence using Curriculum Learning|gomoku
freisleben1995|j|Freisleben|1995|A neural network that learns to play Five-in-a-Row|gomoku
buro1995|j|Buro|1995|Statistical Feature Combination for the Evaluation of Game Positions|learning
buro1999|j|Buro|1999|From Simple Features to Sophisticated Evaluation Functions|learning
buro2002|j|Buro|2002|Improving heuristic mini-max search by supervised learning|learning
tesauro2001|j|Tesauro|2001|Comparison training of chess evaluation functions|learning
hoki2014|j|Hoki|2014|Large-Scale Optimization for Evaluation Functions with Minimax Search|learning
tesauro1989|j|Tesauro|1989|Connectionist Learning of Expert Preferences by Comparison Training|learning
furnkranz1996|j|Fürnkranz|1996|Machine learning in computer chess: The next generation|learning
mandziuk2010|b|Mańdziuk|2010|Knowledge-Free and Learning-Based Methods in Intelligent Game Playing|learning
yannakakis2018|b|Yannakakis|2018|Artificial Intelligence and Games|gameai
lucas2006|j|Lucas|2006|Temporal Difference Learning Versus Co-Evolution for Acquiring Othello Position Evaluation|learning
szubert2014|j|Szubert|2014|Temporal difference learning of N-tuple networks for the game 2048|learning
stern2006|j|Stern|2006|Bayesian pattern ranking for move prediction in the game of Go|learning
araki2007|j|Araki|2007|Move Prediction in Go with the Maximum Entropy Method|learning
bradley1952|j|Bradley|1952|Rank Analysis of Incomplete Block Designs: I. The Method of Paired Comparisons|stats
luce1959|b|Luce|1959|Individual Choice Behavior: A Theoretical Analysis|stats
hunter2004|j|Hunter|2004|MM algorithms for generalized Bradley-Terry models|stats
plackett1975|j|Plackett|1975|The Analysis of Permutations|stats
elo1978|b|Elo|1978|The Rating of Chessplayers, Past and Present|stats
glickman1999|j|Glickman|1999|Parameter estimation in large dynamic paired comparison experiments|stats
herbrich2007|j|Herbrich|2007|TrueSkill™: A Bayesian Skill Rating System|stats
coulom2008|j|Coulom|2008|Whole-History Rating: A Bayesian Rating System for Players of Time-Varying Strength|stats
efron1979|j|Efron|1979|Bootstrap Methods: Another Look at the Jackknife|stats
efron1993|b|Efron|1993|An Introduction to the Bootstrap|stats
wilson1927|j|Wilson|1927|Probable Inference, the Law of Succession, and Statistical Inference|stats
agresti1998|j|Agresti|1998|Approximate Is Better than "Exact" for Interval Estimation of Binomial Proportions|stats
clopper1934|j|Clopper|1934|The use of confidence or fiducial limits illustrated in the case of the binomial|stats
kingma2015|a|Kingma|2014|Adam: A Method for Stochastic Optimization|ml
bishop2006|b|Bishop|2006|Pattern Recognition and Machine Learning|ml
hastie2009|b|Hastie|2009|The Elements of Statistical Learning|ml
goodfellow2016|b|Goodfellow|2016|Deep Learning|ml
nocedal2006|b|Nocedal|2006|Numerical Optimization|ml
platt1999|b|Platt|1999|Probabilistic outputs for support vector machines and comparisons to regularized likelihood methods|ml
niculescu2005|j|Niculescu-Mizil|2005|Predicting good probabilities with supervised learning|ml
guo2017|j|Guo|2017|On Calibration of Modern Neural Networks|ml
brier1950|j|Brier|1950|Verification of forecasts expressed in terms of probability|stats
gneiting2007|j|Gneiting|2007|Strictly Proper Scoring Rules, Prediction, and Estimation|stats
degroot1983|j|DeGroot|1983|The Comparison and Evaluation of Forecasters|stats
gumbel1954|b|Gumbel|1954|Statistical theory of extreme values and some practical applications|stats
maddison2014|j|Maddison|2014|A* Sampling|ml
jang2017|a|Jang|2016|Categorical Reparameterization with Gumbel-Softmax|ml
kool2019|j|Kool|2019|Stochastic Beams and Where to Find Them: The Gumbel-Top-k Trick for Sampling Sequences Without Replacement|ml
yannakakis2015|j|Yannakakis|2015|A Panorama of Artificial and Computational Intelligence in Games|gameai
perezliebana2016|j|Perez-Liebana|2016|General Video Game AI: Competition, Challenges and Opportunities|gameai
genesereth2005|j|Genesereth|2005|General Game Playing: Overview of the AAAI Competition|gameai
bellemare2013|j|Bellemare|2013|The Arcade Learning Environment: An Evaluation Platform for General Agents|gameai
machado2018|j|Machado|2018|Revisiting the Arcade Learning Environment: Evaluation Protocols and Open Problems for General Agents|gameai
lanctot2019|a|Lanctot|2019|OpenSpiel: A Framework for Reinforcement Learning in Games|gameai
brockman2016|a|Brockman|2016|OpenAI Gym|gameai
henderson2018|j|Henderson|2018|Deep Reinforcement Learning That Matters|method
agarwal2021|j|Agarwal|2021|Deep Reinforcement Learning at the Edge of the Statistical Precipice|method
pineau2021|j|Pineau|2021|Improving reproducibility in machine learning research|method
gundersen2018|j|Gundersen|2018|State of the Art: Reproducibility in Artificial Intelligence|method
lipton2019|j|Lipton|2019|Troubling Trends in Machine Learning Scholarship|method
demsar2006|j|Demšar|2006|Statistical Comparisons of Classifiers over Multiple Data Sets|method
cohen1995|b|Cohen|1995|Empirical Methods for Artificial Intelligence|method
ferreira2013|j|Ferreira|2013|The Impact of Search Depth on Chess Playing Strength|scaling
heinz2001|j|Heinz|2001|Self-play, deep search and diminishing returns|scaling
junghanns1997|j|Junghanns|1997|Diminishing Returns for Additional Search in Chess|scaling
mcgrath2022|j|McGrath|2022|Acquisition of chess knowledge in AlphaZero|xai
puri2020|a|Puri|2019|Explain Your Move: Understanding Agent Actions Using Specific and Relevant Feature Attribution|xai
shneiderman2020|j|Shneiderman|2020|Human-Centered Artificial Intelligence: Reliable, Safe & Trustworthy|hci
amershi2019|j|Amershi|2019|Guidelines for Human-AI Interaction|hci
munzner2014|b|Munzner|2014|Visualization Analysis and Design|viz
cleveland1984|j|Cleveland|1984|Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods|viz
heer2010|j|Heer|2010|Crowdsourcing graphical perception: using mechanical turk to assess visualization design|viz
hohman2019|j|Hohman|2019|Visual Analytics in Deep Learning: An Interrogative Survey for the Next Frontiers|viz
shin2023|j|Shin|2023|Superhuman artificial intelligence can improve human decision-making by increasing novelty|hci
mcilroy2020|j|McIlroy-Young|2020|Aligning Superhuman AI with Human Behavior: Chess as a Model System|hci
wang2023adv|a|Wang|2022|Adversarial Policies Beat Superhuman Go AIs|robust
lan2022|a|Lan|2022|Are AlphaZero-like Agents Robust to Adversarial Perturbations?|robust
marsaglia2003|j|Marsaglia|2003|Xorshift RNGs|eng
matsumoto1998|j|Matsumoto|1998|Mersenne twister: a 623-dimensionally equidistributed uniform pseudo-random number generator|eng
carter1979|j|Carter|1979|Universal classes of hash functions|eng
knuth1998|b|Knuth|1998|The Art of Computer Programming, Volume 3: Sorting and Searching|eng
claessen2000|j|Claessen|2000|QuickCheck: a lightweight tool for random testing of Haskell programs|eng
mckeeman1998|j|McKeeman|1998|Differential testing for software|eng
chen2018meta|j|Chen|2018|Metamorphic Testing: A Review of Challenges and Opportunities|eng
segura2016|j|Segura|2016|A Survey on Metamorphic Testing|eng
sandve2013|j|Sandve|2013|Ten Simple Rules for Reproducible Computational Research|method
wilson2014|j|Wilson|2014|Best Practices for Scientific Computing|method
peng2011|j|Peng|2011|Reproducible Research in Computational Science|method
chen2021codex|a|Chen|2021|Evaluating Large Language Models Trained on Code|aitool
peng2023copilot|a|Peng|2023|The Impact of AI on Developer Productivity: Evidence from GitHub Copilot|aitool
vaithilingam2022|j|Vaithilingam|2022|Expectation vs. Experience: Evaluating the Usability of Code Generation Tools Powered by Large Language Models|aitool
barke2023|j|Barke|2023|Grounded Copilot: How Programmers Interact with Code-Generating Models|aitool
ziegler2024|j|Ziegler|2024|Measuring GitHub Copilot's Impact on Productivity|aitool
jimenez2024|a|Jimenez|2023|SWE-bench: Can Language Models Resolve Real-World GitHub Issues?|aitool
ji2023|j|Ji|2023|Survey of Hallucination in Natural Language Generation|aitool
bubeck2023|a|Bubeck|2023|Sparks of Artificial General Intelligence: Early experiments with GPT-4|aitool
openai2023|a|OpenAI|2023|GPT-4 Technical Report|aitool
denny2024|j|Denny|2024|Computing Education in the Era of Generative AI|aitool
becker2023|j|Becker|2023|Programming Is Hard - Or at Least It Used to Be: Educational Opportunities and Challenges of AI Code Generation|aitool
prather2023|j|Prather|2023|The Robots Are Here: Navigating the Generative AI Revolution in Computing Education|aitool
walters2023|j|Walters|2023|Fabrication and errors in the bibliographic citations generated by ChatGPT|aitool
alkaissi2023|j|Alkaissi|2023|Artificial Hallucinations in ChatGPT: Implications in Scientific Writing|aitool
kasneci2023|j|Kasneci|2023|ChatGPT for good? On opportunities and challenges of large language models for education|aitool
liu2023verif|a|Liu|2023|Evaluating Verifiability in Generative Search Engines|aitool
ruoss2024|a|Ruoss|2024|Grandmaster-Level Chess Without Search|scaling
jones2021|a|Jones|2021|Scaling Scaling Laws with Board Games|scaling
neumann2022|a|Neumann|2022|Scaling Laws for a Multi-Agent Reinforcement Learning Model|scaling
kaplan2020|a|Kaplan|2020|Scaling Laws for Neural Language Models|scaling
snell2024|a|Snell|2024|Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters|scaling
brown2024monkeys|a|Brown|2024|Large Language Monkeys: Scaling Inference Compute with Repeated Sampling|scaling
schultz2024|a|Schultz|2024|Mastering Board Games by External and Internal Planning with Language Models|scaling
cazenave2001|j|Cazenave|2001|Abstract Proof Search|threat
thomsen2000|j|Thomsen|2000|Lambda-Search in Game Trees - with Application to Go|threat
yoshizoe2007|j|Yoshizoe|2007|Lambda Depth-First Proof Number Search and Its Application to Go|threat
kishimoto2005|j|Kishimoto|2005|A General Solution to the Graph History Interaction Problem|threat
seo2001|j|Seo|2001|The PN*-search algorithm: Application to tsume-shogi|threat
winands2004|j|Winands|2004|An effective two-level proof-number search algorithm|threat
saffidine2012|j|Saffidine|2012|Solving Breakthrough with Race Patterns and Job-Level Proof Number Search|threat
pawlewicz2014|j|Pawlewicz|2014|Scalable parallel DFPN search|threat
breuker1994|j|Breuker|1994|Replacement Schemes for Transposition Tables|search
hyatt2002|j|Hyatt|2002|A lockless transposition-table implementation for parallel search|search
marsland1985|j|Marsland|1985|Parallel Game-Tree Search|search
reinefeld1983|j|Reinefeld|1983|An Improvement to the Scout Tree Search Algorithm|search
slate1977|b|Slate|1977|CHESS 4.5—The Northwestern University chess program|search
akl1977|j|Akl|1977|The principal continuation and the killer heuristic|search
russell2020|b|Russell|2020|Artificial Intelligence: A Modern Approach|textbook
nilsson1980|b|Nilsson|1980|Principles of Artificial Intelligence|textbook
pearl1984|b|Pearl|1984|Heuristics: Intelligent Search Strategies for Computer Problem Solving|textbook
berlekamp2001|b|Berlekamp|2001|Winning Ways for Your Mathematical Plays|theory
millington2019|b|Millington|2019|AI for Games|gameai
thompson1986|j|Thompson|1986|Retrograde analysis of certain endgames|search
henderson2009|j|Henderson|2009|Solving 8x8 Hex|games
"""
