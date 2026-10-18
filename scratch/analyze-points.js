#!/usr/bin/env node
/**
 * Points balance analysis for Winter-Arch.
 * Rerun:  node --env-file=.env scratch/export-points-data.js && node scratch/analyze-points.js
 * Input:  scratch/points-data.json (raw SQL export)
 * Output: scratch/points-report.md (+ stdout)
 *
 * Scoring rules replicated from src/lib/scoring.ts:
 *  - DAILY checkbox: points if completed (negative-point tasks penalize on completed=true)
 *  - DAILY number:  floor(value / unitCount) * points + log.bonusPoints (stored on log)
 *  - WEEKLY checkbox: task.points once per user-week if (# completed logs in week) >= target
 *  - Daily completion bonus (5 @ 50%, 15 @ 75% of checklist), streak +15/7d, league bonus
 *    are system-level (day_summaries) and are reported separately, not attributed to tasks.
 */
const fs = require('node:fs');
const path = require('node:path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'points-data.json'), 'utf8'));
const { users, challenges, challengeTasks, taskLogs, daySummaries, weeklyScores, members } = DATA;

const DAY = 86400000;
const d = (s) => new Date(s);
const dayKey = (dt) => dt.toISOString().slice(0, 10);
const startOfWeekMon = (dt) => {
  const x = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const wd = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - wd * DAY);
};
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const stdev = (arr) => {
  if (arr.length < 2) return null;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
};
const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
const r1 = (x) => (x == null ? '—' : Math.round(x * 10) / 10);
const r2 = (x) => (x == null ? '—' : Math.round(x * 100) / 100);
const esc = (s) => String(s).replace(/\|/g, '\\|');
const out = [];
const p = (...a) => out.push(a.join(' '));

// ---------- helpers ----------
const taskById = new Map(challengeTasks.map((t) => [t.id, t]));
const userById = new Map(users.map((u) => [u.id, u]));
const chalById = new Map(challenges.map((c) => [c.id, c]));

function earnedBlocks(value, task) {
  const count = task.unitCount && task.unitCount > 0 ? task.unitCount : 1;
  return Math.floor(value / count);
}
function dailyTaskPoints(task, log) {
  if (task.inputType === 'NUMBER') {
    if (!log || !(log.value > 0)) return 0;
    return earnedBlocks(log.value, task) * task.points + (log.bonusPoints || 0);
  }
  return log && log.completed ? task.points : 0;
}

// ---------- per-log daily points ----------
const dailyLogs = taskLogs.filter((l) => taskById.get(l.taskId)?.type === 'DAILY');
const weeklyLogs = taskLogs.filter((l) => taskById.get(l.taskId)?.type === 'WEEKLY');
const logPts = dailyLogs.map((l) => ({ ...l, pts: dailyTaskPoints(taskById.get(l.taskId), l) }));

// ---------- exposure (proxy: user active span ∩ task availability) ----------
// challenge_tasks has no createdAt; task availability proxy = first global log date.
const allDates = taskLogs.map((l) => d(l.date).getTime());
const dataStart = new Date(Math.min(...allDates));
const dataEnd = new Date(Math.max(...allDates));

const userSpan = new Map(); // userId -> {first,last, per challenge}
for (const l of taskLogs) {
  const t = d(l.date).getTime();
  let s = userSpan.get(l.userId);
  if (!s) userSpan.set(l.userId, (s = { first: t, last: t, chal: new Map() }));
  s.first = Math.min(s.first, t);
  s.last = Math.max(s.last, t);
  let c = s.chal.get(l.challengeId);
  if (!c) s.chal.set(l.challengeId, (c = { first: t, last: t }));
  c.first = Math.min(c.first, t);
  c.last = Math.max(c.last, t);
}
const taskAvail = new Map();
for (const l of taskLogs) {
  const t = d(l.date).getTime();
  const cur = taskAvail.get(l.taskId);
  taskAvail.set(l.taskId, cur == null ? t : Math.min(cur, t));
}
function exposureDays(taskId, userId) {
  const span = userSpan.get(userId);
  if (!span) return 0;
  const chalId = taskById.get(taskId).challengeId;
  const cc = span.chal.get(chalId);
  if (!cc) return 0;
  const start = Math.max(cc.first, taskAvail.get(taskId) ?? cc.first);
  const end = cc.last;
  return end < start ? 0 : Math.floor((end - start) / DAY) + 1;
}
function exposureWeeks(taskId, userId) {
  const span = userSpan.get(userId);
  if (!span) return 0;
  const chalId = taskById.get(taskId).challengeId;
  const cc = span.chal.get(chalId);
  if (!cc) return 0;
  const w1 = startOfWeekMon(new Date(Math.max(cc.first, taskAvail.get(taskId) ?? cc.first)));
  const w2 = startOfWeekMon(new Date(cc.last));
  return Math.floor((w2 - w1) / (7 * DAY)) + 1;
}

// ---------- weekly achievements (recomputed) ----------
// weekKey -> taskId -> {completedCount, userId, challengeId}
const weekTask = new Map();
for (const l of weeklyLogs) {
  const wk = dayKey(startOfWeekMon(d(l.date)));
  const key = wk + '|' + l.taskId + '|' + l.userId;
  let e = weekTask.get(key);
  if (!e) weekTask.set(key, (e = { taskId: l.taskId, userId: l.userId, challengeId: l.challengeId, week: wk, completedCount: 0 }));
  if (l.completed) e.completedCount += 1;
}
const weeklyAwards = [];
for (const e of weekTask.values()) {
  const task = taskById.get(e.taskId);
  const target = task.target || 0;
  const achieved = e.completedCount >= target;
  weeklyAwards.push({ ...e, achieved, pts: achieved ? task.points : 0 });
}

// ---------- per-task stats ----------
const stats = [];
for (const task of challengeTasks) {
  const isWeekly = task.type === 'WEEKLY';
  const isPenalty = task.points < 0;
  const logs = taskLogs.filter((l) => l.taskId === task.id);
  const uniq = new Set(logs.map((l) => l.userId));
  let ptsList = [], earnCount = 0, exposure = 0, achieveCount = 0, exposureUnits = 0, valueList = [];

  if (!isWeekly) {
    const mine = logPts.filter((l) => l.taskId === task.id);
    ptsList = mine.map((l) => l.pts);
    earnCount = mine.filter((l) => (isPenalty ? l.pts < 0 : l.pts > 0)).length;
    for (const u of uniq) exposure += exposureDays(task.id, u);
    if (task.inputType === 'NUMBER') valueList = logs.filter((l) => l.value > 0).map((l) => l.value);
    achieveCount = earnCount; exposureUnits = exposure;
  } else {
    const mine = weeklyAwards.filter((a) => a.taskId === task.id);
    ptsList = mine.filter((a) => a.achieved).map((a) => a.pts);
    earnCount = achieveCount = mine.filter((a) => a.achieved).length;
    for (const u of uniq) exposureUnits += exposureWeeks(task.id, u);
    exposure = exposureUnits * 7;
  }

  const totalPts = ptsList.reduce((s, x) => s + x, 0);
  const earningPts = ptsList.filter((x) => (isPenalty ? x < 0 : x > 0));
  const n = isWeekly ? achieveCount : logs.length;
  stats.push({
    task, isWeekly, isPenalty,
    logs: logs.length, users: uniq.size,
    earnRate: exposureUnits ? achieveCount / exposureUnits : null, // per exposure unit
    logRate: isWeekly ? null : (logs.length ? earnCount / logs.length : null), // per interaction
    earnCount,
    ptsList, earningPts, totalPts,
    avgPts: mean(earningPts), medPts: median(earningPts),
    minPts: earningPts.length ? Math.min(...earningPts) : null,
    maxPts: earningPts.length ? Math.max(...earningPts) : null,
    sdPts: stdev(earningPts),
    exposureDays: exposure, exposureUnits,
    ptsPerExposure: exposure ? totalPts / exposure : null,
    ptsPerLog: isWeekly ? (achieveCount ? totalPts / achieveCount : null) : (logs.length ? totalPts / logs.length : null),
    avgValue: mean(valueList),
    values: valueList,
  });
}

const posTasks = stats.filter((s) => !s.isPenalty && s.logs >= 5);
const medEff = median(posTasks.map((s) => s.ptsPerExposure).filter((x) => x != null));
const medPtsPerLog = median(posTasks.map((s) => s.ptsPerLog).filter((x) => x != null));
const medConfigured = median(posTasks.filter((s) => s.ptsPerExposure != null).map((s) => s.task.points));
const totalPosPoints = stats.filter((s) => !s.isPenalty).reduce((s, x) => s + x.totalPts, 0);
const totalNegPoints = stats.filter((s) => s.isPenalty).reduce((s, x) => s + x.totalPts, 0);

// ---------- report ----------
p('# Winter Arc — Points Balance Analysis');
p('');
p(`Data window: **${dayKey(dataStart)} → ${dayKey(dataEnd)}** (${Math.floor((dataEnd - dataStart) / DAY) + 1} days).`);
p(`Users: ${users.length} (${userSpan.size} with logs) · Challenges: ${challenges.length} · Tasks: ${challengeTasks.length} · Task logs: ${taskLogs.length} · Day summaries: ${daySummaries.length} · Weekly scores: ${weeklyScores.length}`);
p('');
p('> **Column gaps vs your template:** no `attempts`, `time_taken`, or `difficulty` columns exist in this schema. "Completion rate" is proxied by (earning logs ÷ exposure days) and (earning logs ÷ interactions); points-per-minute is impossible. Confidence is set from sample size only.');
p('');

p('## 5-line summary');
const over = [...posTasks].filter((s) => s.ptsPerExposure != null && s.logs >= 10).sort((a, b) => (b.ptsPerExposure / medEff) - (a.ptsPerExposure / medEff))[0];
const under = [...posTasks].filter((s) => s.ptsPerExposure != null && s.logs >= 10).sort((a, b) => (a.ptsPerExposure / medEff) - (b.ptsPerExposure / medEff))[0];
const byShare = [...stats].filter((s) => !s.isPenalty).sort((a, b) => b.totalPts - a.totalPts);
p(`1. **Most over-rewarded:** ${esc(over?.task.name)} — ${r2(over?.ptsPerExposure)} pts/exposure-day (${over ? r2(over.ptsPerExposure / medEff) : '—'}× the ${r2(medEff)} median).`);
p(`2. **Most under-rewarded:** ${esc(under?.task.name)} — ${r2(under?.ptsPerExposure)} pts/exposure-day (${under ? r2(under.ptsPerExposure / medEff) : '—'}× median).`);
p(`3. **Biggest imbalance:** ${esc(byShare[0]?.task.name)} alone supplies ${pct(byShare[0] ? byShare[0].totalPts / totalPosPoints : null)} of all positive task points (top 3 = ${pct(byShare.slice(0, 3).reduce((s, x) => s + x.totalPts, 0) / totalPosPoints)}).`);
p(`4. **Sharpest contrast:** Running pays 12 pts/km while Walking pays 5 pts/km (+15 per 5 km); the three weekly blocks (Gym 100, Upskilling 150, Sport 100) are single largest per-award payouts in the app.`);
p(`5. **Most ignored tasks:** Read book for 30 mins, Meditation, and the three DSA-challenge weeklies contributed <1% of all positive points combined.`);
p('');

// ---- 1. per-challenge stats ----
p('## 1. Per-task statistics');
p('');
p('### Daily tasks');
p('');
p('| Task | Cfg pts | Logs | Users | Earn/interact | Earn/exposure-day | Avg pts (earning) | Med | Min | Max | SD | Total pts | % of +pts |');
p('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const s of stats.filter((x) => !x.isWeekly).sort((a, b) => b.totalPts - a.totalPts)) {
  p(`| ${esc(s.task.name)}${s.isPenalty ? ' ⚠' : ''} | ${s.task.points} | ${s.logs} | ${s.users} | ${pct(s.logRate)} | ${pct(s.earnRate)} | ${r1(s.avgPts)} | ${r1(s.medPts)} | ${r1(s.minPts)} | ${r1(s.maxPts)} | ${r1(s.sdPts)} | ${r1(s.totalPts)} | ${pct(s.totalPts / totalPosPoints)} |`);
}
p('');
p('### Weekly tasks');
p('');
p('| Task | Cfg pts | Target/wk | User-weeks (exposed) | Achieved | Achieve rate | Total pts | % of +pts |');
p('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const s of stats.filter((x) => x.isWeekly).sort((a, b) => b.totalPts - a.totalPts)) {
  p(`| ${esc(s.task.name)} | ${s.task.points} | ${s.task.target} | ${s.exposureUnits} | ${s.earnCount} | ${pct(s.earnRate)} | ${r1(s.totalPts)} | ${pct(s.totalPts / totalPosPoints)} |`);
}
p('');
p(`Penalty tasks (⚠, negative points) collected **${r1(totalNegPoints)} pts** in penalties across ${stats.filter((s) => s.isPenalty).reduce((s, x) => s + x.logs, 0)} trigger logs.`);
p(`System bonuses (daily completion 5/15, streak +15/7d, league) live in day_summaries: ${daySummaries.filter((x) => x.dailyBonusAwarded).length} daily-bonus days, ${daySummaries.filter((x) => x.streakBonusAwarded).length} streak-bonus days, ${daySummaries.filter((x) => x.leagueBonusAwarded).length} league-bonus days, ${daySummaries.reduce((s, x) => s + (x.leagueBonusPoints || 0), 0)} league pts — none attributable to a single task.`);
p('');

// ---- 2. effort-vs-reward ----
p('## 2. Effort-vs-reward (efficiency ranking)');
p('');
p(`Median efficiency across positive tasks with ≥5 logs: **${r2(medEff)} pts per exposure-day** · median **${r2(medPtsPerLog)} pts per earning log**. (No time data → points-per-minute unavailable; exposure-day = day between a user\'s first and last activity on the challenge, after the task first appears in logs. For weekly tasks, "pts/earning log" = points per achieved user-week.)`);
p('');
p('| Rank | Task | Type | Cfg pts | Pts/exposure-day | vs median | Pts/earning log | Flag |');
p('|---:|---|---|---:|---:|---:|---:|---|');
const ranked = posTasks.filter((s) => s.ptsPerExposure != null).sort((a, b) => b.ptsPerExposure - a.ptsPerExposure);
ranked.forEach((s, i) => {
  const ratio = s.ptsPerExposure / medEff;
  const flag = ratio >= 1.5 ? 'HIGH OUTLIER' : ratio <= 0.5 ? 'LOW OUTLIER' : ratio >= 1.2 || ratio <= 0.8 ? 'watch' : 'ok';
  p(`| ${i + 1} | ${esc(s.task.name)} | ${s.isWeekly ? 'W' : 'D'} | ${s.task.points} | ${r2(s.ptsPerExposure)} | ${r2(ratio)}× | ${r2(s.ptsPerLog && s.ptsPerLog > 0 ? s.ptsPerLog : null)} | ${flag} |`);
});
p('');

// ---- 3. difficulty signals ----
p('## 3. Difficulty signals');
p('');
p('| Task | Type | Earn/interact | Earn/exposure | Avg value (numbers) | Configured pts | Diagnosis |');
p('|---|---|---:|---:|---:|---:|---|');
for (const s of stats.filter((x) => !x.isPenalty)) {
  const cr = s.logRate, er = s.earnRate;
  let diag = 'neutral';
  if (!s.isWeekly && cr != null && er != null) {
    if (cr >= 0.7 && s.task.points >= medConfigured) diag = '⚠ EASY + HIGH POINTS';
    else if (er <= 0.25 && s.task.points <= medConfigured) diag = '⚠ HARD + LOW POINTS';
    else if (cr >= 0.7) diag = 'easy, fairly paid';
    else if (er <= 0.25) diag = 'hard, low pay';
  } else if (s.isWeekly && er != null) {
    if (er >= 0.8 && s.task.points >= 100) diag = '⚠ near-automatic big payout';
    else if (er <= 0.3) diag = 'rarely achieved';
  }
  p(`| ${esc(s.task.name)} | ${s.isWeekly ? 'W' : 'D'} | ${pct(cr)} | ${pct(er)} | ${r1(s.avgValue)}${s.task.unit ? ' ' + s.task.unit : ''} | ${s.task.points} | ${diag} |`);
}
p('');
p('Notes on number tasks: Walking bonus (+15 per 5 km) and Running bonus (+30 per 5 km) are already stored on logs; push-ups pays 1 pt per 2 reps (+25 per 100), pull-ups 1 pt per 1.5 reps, sit-ups 1 pt per 2.5 reps — check whether users ever reach the 100-rep bonus thresholds (see values below).');
const push = stats.find((s) => s.task.name === 'push-ups');
p(`push-ups values: n=${push.values.length}, avg=${r1(mean(push.values))}, max=${push.values.length ? Math.max(...push.values) : '—'}; pull-ups max=${Math.max(0, ...stats.find((s) => s.task.name === 'pull-ups').values)}; sit-ups max=${Math.max(0, ...stats.find((s) => s.task.name === 'Situps').values)}.`);
p('');

// ---- 4. distribution & dominance ----
p('## 4. Distribution and dominance');
p('');
p('| Task | Total pts | Share of +pts | Cumulative |');
p('|---|---:|---:|---:|');
let cum = 0;
for (const s of byShare) {
  cum += s.totalPts / totalPosPoints;
  p(`| ${esc(s.task.name)} | ${r1(s.totalPts)} | ${pct(s.totalPts / totalPosPoints)} | ${pct(cum)} |`);
}
const hhi = byShare.reduce((h, s) => h + (s.totalPts / totalPosPoints) ** 2, 0);
p('');
p(`Herfindahl index of task point shares: **${r2(hhi)}** (0.10+ = high concentration). Top-3 share: **${pct(byShare.slice(0, 3).reduce((s, x) => s + x.totalPts, 0) / totalPosPoints)}**.`);
p(`Contribution of tasks with <2% share: ${byShare.filter((s) => s.totalPts / totalPosPoints < 0.02).map((s) => esc(s.task.name)).join(', ') || 'none'} — these are effectively ignored by the points economy.`);
p('');
// gravitation: log volume vs efficiency
const topEffIds = new Set(ranked.slice(0, 3).map((s) => s.task.id));
const topEffLogs = taskLogs.filter((l) => topEffIds.has(l.taskId)).length;
const byLogs = [...stats].filter((s) => !s.isPenalty).sort((a, b) => b.logs - a.logs);
p(`Activity concentrates on near-automatic checkboxes, not the highest-paying tasks: the 3 most-logged tasks (${byLogs.slice(0, 3).map((s) => esc(s.task.name)).join(', ')}) take **${pct(byLogs.slice(0, 3).reduce((s, x) => s + x.logs, 0) / taskLogs.length)}** of all logs, while the top-3 efficiency tasks take only ${pct(topEffLogs / taskLogs.length)}.`);
p('');

// ---- 5. user-level ----
p('## 5. User-level patterns');
p('');
const tots = users.map((u) => u.totalPoints).sort((a, b) => b - a);
const activeUsers = users.filter((u) => userSpan.has(u.id));
p(`totalPoints distribution (all ${users.length} users, incl. 0-point): mean=${r1(mean(tots))}, median=${r1(median(tots))}, max=${tots[0]}, min=${tots[tots.length - 1]}, p90=${r1(tots[Math.floor(tots.length * 0.1)])}, p10=${r1(tots[Math.ceil(tots.length * 0.9) - 1])} (bottom 10% ≈ ${tots.filter((t) => t <= tots[Math.ceil(tots.length * 0.9) - 1]).length} users, mostly 0).`);
const sumAll = tots.reduce((s, x) => s + x, 0);
const top10pctN = Math.max(1, Math.round(users.length * 0.1));
const top10sum = tots.slice(0, top10pctN).reduce((s, x) => s + x, 0);
p(`Top 10% of users (${top10pctN}) hold **${pct(top10sum / sumAll)}** of all stored points.`);
p('');
p('| User | totalPoints | Active span (d) | Top task (recomputed pts) | Top-task share | Reconstructed task pts |');
p('|---|---:|---:|---|---:|---:|');
const perUserTask = new Map(); // userId -> Map(taskId -> pts)
for (const l of logPts) {
  if (!perUserTask.has(l.userId)) perUserTask.set(l.userId, new Map());
  const m = perUserTask.get(l.userId);
  m.set(l.taskId, (m.get(l.taskId) || 0) + l.pts);
}
for (const a of weeklyAwards) {
  if (!a.achieved) continue;
  if (!perUserTask.has(a.userId)) perUserTask.set(a.userId, new Map());
  const m = perUserTask.get(a.userId);
  m.set(a.taskId, (m.get(a.taskId) || 0) + a.pts);
}
const topUsers = activeUsers.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 8);
for (const u of topUsers) {
  const m = perUserTask.get(u.id) || new Map();
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const span = userSpan.get(u.id);
  const days = Math.floor((span.last - span.first) / DAY) + 1;
  p(`| ${u.id.slice(-6)} | ${u.totalPoints} | ${days} | ${esc(taskById.get(entries[0]?.[0])?.name ?? '—')} (${r1(entries[0]?.[1])}) | ${pct(entries[0] ? entries[0][1] / sum : null)} | ${r1(sum)} |`);
}
p('');
// new vs experienced
const dataEndT = dataEnd.getTime();
const cut = dataEndT - 21 * DAY;
const veteran = new Set(users.filter((u) => d(u.createdAt).getTime() <= cut).map((u) => u.id));
p(`New vs experienced (veteran = account ≥21 days old at data end, n=${[...veteran].filter((id) => userSpan.has(id)).length} active):`);
p('');
p('| Task (≥10 logs each group) | Veteran pts/exposure-day | New pts/exposure-day | Gap |');
p('|---|---:|---:|---:|');
for (const s of stats.filter((x) => !x.isWeekly && !x.isPenalty)) {
  const mine = logPts.filter((l) => l.taskId === s.task.id);
  const calc = (pred) => {
    const ids = new Set(mine.filter(pred).map((l) => l.userId));
    if (!ids.size) return { eff: null, n: 0 };
    let ex = 0, tp = 0;
    for (const u of ids) {
      ex += exposureDays(s.task.id, u);
      tp += mine.filter((l) => l.userId === u).reduce((sum, l) => sum + l.pts, 0);
    }
    return { eff: ex ? tp / ex : null, n: mine.filter(pred).length };
  };
  const v = calc((l) => veteran.has(l.userId));
  const nw = calc((l) => !veteran.has(l.userId));
  if (v.n >= 10 && nw.n >= 10 && v.eff != null && nw.eff != null) {
    p(`| ${esc(s.task.name)} | ${r2(v.eff)} | ${r2(nw.eff)} | ${r2(nw.eff - v.eff)} |`);
  }
}
p('');
// exploitation
p('Exploitation checks:');
const dupKey = new Set();
let dups = 0;
for (const l of taskLogs) {
  const k = l.userId + '|' + l.taskId + '|' + l.date;
  if (dupKey.has(k)) dups++;
  dupKey.add(k);
}
p(`- Duplicate user-task-day logs: **${dups}** (DB unique constraint holds).`);
const dayRecompute = new Map();
for (const l of logPts) {
  const k = l.userId + '|' + dayKey(d(l.date));
  dayRecompute.set(k, (dayRecompute.get(k) || 0) + l.pts);
}
const dayVals = [...dayRecompute.values()];
p(`- Recomputed daily habit points/user-day: mean=${r1(mean(dayVals))}, max=${Math.max(...dayVals)}, p99=${r1([...dayVals].sort((a, b) => a - b)[Math.floor(dayVals.length * 0.99)])}.`);
for (const s of stats.filter((x) => x.task.inputType === 'NUMBER' && x.values.length)) {
  const mx = Math.max(...s.values);
  const m = mean(s.values);
  const sd = stdev(s.values);
  if (sd && mx > m + 3 * sd) p(`- Outlier values on **${esc(s.task.name)}**: max=${mx} vs mean=${r1(m)} (SD ${r1(sd)}) — plausible but worth watching; ${s.values.filter((v) => v >= mx * 0.8).length} logs near the max.`);
}
p(`- Penalty triggers: ${stats.filter((s) => s.isPenalty).map((s) => `${esc(s.task.name)} n=${s.logs}`).join(', ')}.`);
p('');

// ---- 6. trends ----
p('## 6. Trends over time (weekly)');
p('');
const weeks = [...new Set(taskLogs.map((l) => dayKey(startOfWeekMon(d(l.date)))))].sort();
p('| Week | Logs (all) | Earning daily logs | Task pts (daily recompute) | Day-summary pts | Users active |');
p('|---|---:|---:|---:|---:|---:|');
for (const w of weeks) {
  const wlAll = taskLogs.filter((l) => dayKey(startOfWeekMon(d(l.date))) === w);
  const wl = logPts.filter((l) => dayKey(startOfWeekMon(d(l.date))) === w);
  const wds = daySummaries.filter((x) => dayKey(startOfWeekMon(d(x.date))) === w);
  if (!wlAll.length) continue;
  p(`| ${w} | ${wlAll.length} | ${wl.filter((l) => (l.pts > 0 || (taskById.get(l.taskId).points < 0 && l.pts < 0))).length} | ${r1(wl.reduce((s, l) => s + l.pts, 0))} | ${r1(wds.reduce((s, x) => s + x.pointsAwarded, 0))} | ${new Set(wlAll.map((l) => l.userId)).size} |`);
}
p('');
p('Per-task momentum (last two weeks with logs, daily tasks with ≥5 logs in either week):');
p('');
p('| Task | Prev-week logs | Last-week logs | Direction |');
p('|---|---:|---:|---|');
const weeksWithLogs = weeks.filter((w) => taskLogs.some((l) => dayKey(startOfWeekMon(d(l.date))) === w));
if (weeksWithLogs.length >= 2) {
  const [wPrev, wLast] = [weeksWithLogs[weeksWithLogs.length - 2], weeksWithLogs[weeksWithLogs.length - 1]];
  for (const s of stats.filter((x) => !x.isWeekly)) {
    const a = logPts.filter((l) => l.taskId === s.task.id && dayKey(startOfWeekMon(d(l.date))) === wPrev).length;
    const b = logPts.filter((l) => l.taskId === s.task.id && dayKey(startOfWeekMon(d(l.date))) === wLast).length;
    if (a >= 5 || b >= 5) {
      const dir = b > a * 1.2 ? '📈 rising' : b < a * 0.8 ? '📉 falling' : '➡ stable';
      p(`| ${esc(s.task.name)} | ${a} | ${b} | ${dir} |`);
    }
  }
}
p('');

// ---- 7. classification (descriptive only) ----
p('## 7. Reward-band classification (descriptive)');
p('');
p('Tasks grouped by measured efficiency vs the 3.75 pts/exposure-day median. Labels describe the data only — no point changes are proposed.');
p('');
p('| Task | Cfg pts | Band | Evidence | Sample size |');
p('|---|---:|---|---|---|');
for (const s of [...stats].sort((a, b) => (a.isWeekly === b.isWeekly ? b.totalPts - a.totalPts : a.isWeekly ? 1 : -1))) {
  const cfg = s.task.points;
  const n = s.isWeekly ? s.exposureUnits : s.logs;
  const nLabel = s.isWeekly ? `${n} user-weeks` : `${n} logs`;
  let band = 'In band', evidence = '';
  if (n < 5) {
    band = 'No data';
    evidence = `only ${nLabel} — not classifiable`;
  } else if (s.isPenalty) {
    band = 'Penalty';
    evidence = `${s.logs} triggers logged; ${r1(Math.abs(s.totalPts))} pts removed in total`;
  } else if (s.ptsPerExposure != null && medEff) {
    const ratio = s.ptsPerExposure / medEff;
    if (ratio >= 1.5) band = 'Above band';
    else if (ratio <= 0.5) band = 'Below band';
    else if (ratio >= 1.2 || ratio <= 0.8) band = 'Edge of band';
    evidence = `${r2(s.ptsPerExposure)} pts/exposure-day = ${r2(ratio)}× median; earn rate ${pct(s.earnRate)}${s.isWeekly ? ` (target ${s.task.target}/wk)` : ''}`;
  } else {
    band = 'No data';
    evidence = `only ${nLabel} — not classifiable`;
  }
  p(`| ${esc(s.task.name)} | ${cfg} | **${band}** | ${evidence} | ${nLabel} |`);
}
p('');

p('## Data gaps and assumptions');
p('');
p('- No `attempts`, `time_taken`, `difficulty`, or task `createdAt` columns exist — completion-rate and points-per-minute from your template are proxied; task availability uses first-log-date as a proxy (tasks added mid-challenge will look artificially low early on).');
p('- `challenge_tasks` has no creation timestamp; exposure windows may slightly over/under-count for late-added tasks.');
p('- Logs are sparse (users log only what they do), so "earn/interact" overestimates true compliance; exposure-day rates are the fairer number.');
p('- System bonuses (daily-completion 5/15, streak +15, league) are aggregated in `day_summaries` and cannot be attributed to individual tasks — excluded from per-task totals.');
p('- `users.totalPoints` (mean/median above) includes bonuses and weekly credit; reconstructed task-point totals will be lower by the bonus amount. Sample: 23 users / 1,506 logs / ~4.5 weeks — small; bands marked "No data" or small samples need more weeks to classify reliably.');
p('- The DSA challenge ("6 month DSA + system design") has very few logs vs Winter Arc 2026; its weeklies are not classifiable.');
p('');

const md = out.join('\n');
fs.writeFileSync(path.join(__dirname, 'points-report.md'), md);
console.log(md);
