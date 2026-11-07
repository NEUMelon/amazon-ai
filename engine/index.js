'use strict';
// 引擎入口：汇总导出（Node.js 与浏览器打包共用）
const C = require('./core.js');
const E = require('./eval.js');
const M = require('./movegen.js');
const S = require('./search.js');
const T = require('./mcts.js');
const A = require('./agents.js');
const P = require('./policy.js');
module.exports = Object.assign({}, C, { Eval: E, MoveGen: M, Search: S, MCTSMod: T, Policy: P }, A, { evaluate: E.evaluate, territoryMap: E.territoryMap });
