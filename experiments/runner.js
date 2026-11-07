'use strict';
/*
 * 并行对局调度器
 *   node experiments/runner.js jobs.json out.jsonl [workers]
 * jobs.json: [{ id, tag, white: {agent, opts}, black: {agent, opts}, opening: [...着法字符串], seed }]（白方先走）
 * 每局结果写一行 JSON；已完成的 id 会被跳过（支持断点续跑）。
 */
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

if (process.argv[2] === '--worker') {
  const G = require('../engine');
  const { playGame } = require('./arena.js');
  const root = path.join(__dirname, '..');
  const pw = path.join(root, 'models', 'policy_weights.json');
  if (fs.existsSync(pw)) G.setPolicyTheta(JSON.parse(fs.readFileSync(pw)).theta);
  const tw = path.join(root, 'models', 'eval_weights_tuned.json');
  if (fs.existsSync(tw)) G.setTunedWeights(JSON.parse(fs.readFileSync(tw)).weights);
  process.on('message', job => {
    const mk = s => G.makeAgent(s.agent, Object.assign({ seed: (job.seed || 1) * 7919 + (s === job.white ? 1 : 2) }, s.opts || {}));
    const t0 = Date.now();
    const g = playGame(mk(job.white), mk(job.black), job.opening.map(G.parseMove));
    const out = { id: job.id, tag: job.tag, white: job.white, black: job.black, opening: job.opening, winner: g.winner, length: g.length,
      moves: g.moves.map(G.moveToStr), wallMs: Date.now() - t0 };
    out.log = g.log.map(x => ({ s: x.side, m: G.moveToStr(x.move), ms: +x.ms.toFixed(1), r: x.reason, sc: x.score, d: x.depth, n: x.nodes, sims: x.sims, wr: x.winrate != null ? +(+x.winrate).toFixed(4) : undefined, sd: x.selDepth }));
    process.send(out);
  });
  process.send({ ready: true });
  return;
}

const [jobsFile, outFile, nw] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile));
const done = new Set();
if (fs.existsSync(outFile)) for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) if (line.trim()) done.add(JSON.parse(line).id);
const queue = jobs.filter(j => !done.has(j.id));
const W = +(nw || 3);
const TOTAL = queue.length;
console.log(`${jobs.length} jobs, ${done.size} done, ${queue.length} to run, ${W} workers`);
const out = fs.openSync(outFile, 'a');
let finished = 0, active = 0;
const t0 = Date.now();
for (let i = 0; i < Math.min(W, queue.length); i++) {
  const w = fork(__filename, ['--worker']);
  active++;
  w.on('message', msg => {
    if (!msg.ready) {
      fs.writeSync(out, JSON.stringify(msg) + '\n');
      finished++;
      if (finished % 20 === 0 || finished === TOTAL) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${finished}/${TOTAL}  ${el.toFixed(0)}s  eta ${(el / finished * (TOTAL - finished)).toFixed(0)}s`);
      }
    }
    const j = queue.shift();
    if (j) w.send(j); else { w.kill(); if (--active === 0) fs.closeSync(out); }
  });
}
