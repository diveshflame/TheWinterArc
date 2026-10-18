# Winter Arc — Points Balance Analysis

Data window: **2026-09-22 → 2026-10-18** (27 days).
Users: 23 (14 with logs) · Challenges: 2 · Tasks: 28 · Task logs: 1506 · Day summaries: 138 · Weekly scores: 26

> **Column gaps vs your template:** no `attempts`, `time_taken`, or `difficulty` columns exist in this schema. "Completion rate" is proxied by (earning logs ÷ exposure days) and (earning logs ÷ interactions); points-per-minute is impossible. Confidence is set from sample size only.

## 5-line summary
1. **Most over-rewarded:** push-ups — 27.59 pts/exposure-day (7.36× the 3.75 median).
2. **Most under-rewarded:** Read book for 30 mins — 0.71 pts/exposure-day (0.19× median).
3. **Biggest imbalance:** push-ups alone supplies 19.5% of all positive task points (top 3 = 42.2%).
4. **Sharpest contrast:** Running pays 12 pts/km while Walking pays 5 pts/km (+15 per 5 km); the three weekly blocks (Gym 100, Upskilling 150, Sport 100) are single largest per-award payouts in the app.
5. **Most ignored tasks:** Read book for 30 mins, Meditation.

## 1. Per-task statistics

### Daily tasks

| Task | Cfg pts | Logs | Users | Earn/interact | Earn/exposure-day | Avg pts (earning) | Med | Min | Max | SD | Total pts | % of +pts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| push-ups | 1 | 61 | 8 | 95.1% | 55.2% | 49.9 | 56 | 1 | 116 | 30.9 | 2897 | 19.5% |
| 1.5x body weight Protein instake | 20 | 87 | 12 | 97.7% | 60.7% | 20 | 20 | 20 | 20 | 0 | 1700 | 11.4% |
| Walking | 5 | 81 | 11 | 98.8% | 57.6% | 21.1 | 15 | 5 | 75 | 18.1 | 1685 | 11.3% |
| all day meals at home | 15 | 90 | 11 | 93.3% | 60.4% | 15 | 15 | 15 | 15 | 0 | 1260 | 8.5% |
| No junk food | 10 | 100 | 12 | 96.0% | 68.6% | 10 | 10 | 10 | 10 | 0 | 960 | 6.5% |
| 8 hour sleep last night | 10 | 91 | 13 | 98.9% | 60.4% | 10 | 10 | 10 | 10 | 0 | 900 | 6.1% |
| No sugar | 10 | 91 | 11 | 85.7% | 56.1% | 10 | 10 | 10 | 10 | 0 | 780 | 5.2% |
| 2L water | 5 | 113 | 12 | 98.2% | 75.0% | 5 | 5 | 5 | 5 | 0 | 555 | 3.7% |
| No phone while eating | 5 | 99 | 12 | 97.0% | 71.1% | 5 | 5 | 5 | 5 | 0 | 480 | 3.2% |
| Running | 12 | 16 | 7 | 68.8% | 11.7% | 39.8 | 12 | 12 | 102 | 36.9 | 438 | 2.9% |
| Morning - Make your bed | 3 | 128 | 13 | 98.4% | 89.4% | 3 | 3 | 3 | 3 | 0 | 378 | 2.5% |
| Skin care | 3 | 122 | 11 | 98.4% | 86.3% | 3 | 3 | 3 | 3 | 0 | 360 | 2.4% |
| Cold shower | 5 | 74 | 8 | 91.9% | 64.8% | 5 | 5 | 5 | 5 | 0 | 340 | 2.3% |
| pull-ups | 1 | 21 | 8 | 81.0% | 15.7% | 15.1 | 16 | 4 | 33 | 8.7 | 256 | 1.7% |
| Situps | 1 | 8 | 4 | 100.0% | 66.7% | 31.3 | 35 | 8 | 43 | 12.4 | 250 | 1.7% |
| 1 fruit intake | 2 | 122 | 12 | 99.2% | 81.8% | 2 | 2 | 2 | 2 | 0 | 242 | 1.6% |
| Read book for 30 mins | 5 | 18 | 7 | 66.7% | 14.1% | 5 | 5 | 5 | 5 | 0 | 60 | 0.4% |
| Meditation for 30 minutes | 5 | 7 | 3 | 85.7% | 15.4% | 5 | 5 | 5 | 5 | 0 | 30 | 0.2% |
| Drank Alcohol ⚠ | -10 | 4 | 3 | 50.0% | 4.8% | -10 | -10 | -10 | -10 | 0 | -20 | -0.1% |
| Masturbation ⚠ | -10 | 9 | 6 | 66.7% | 9.0% | -10 | -10 | -10 | -10 | 0 | -60 | -0.4% |
| Ciggerate ⚠ | -10 | 12 | 2 | 91.7% | 39.3% | -10 | -10 | -10 | -10 | 0 | -110 | -0.7% |
| Total screen time above 3 hours ⚠ | -3 | 52 | 9 | 94.2% | 41.5% | -8.1 | -6 | -21 | -3 | 4.5 | -396 | -2.7% |

### Weekly tasks

| Task | Cfg pts | Target/wk | User-weeks (exposed) | Achieved | Achieve rate | Total pts | % of +pts |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gym | 100 | 4 | 13 | 8 | 61.5% | 800 | 5.4% |
| Upskilling (Min 90 mins) | 150 | 5 | 12 | 2 | 16.7% | 300 | 2.0% |
| Sport | 100 | 4 | 12 | 2 | 16.7% | 200 | 1.3% |
| AI systems | 10 | 4 | 1 | 0 | 0.0% | 0 | 0.0% |
| System design 1 hour | 20 | 6 | 1 | 0 | 0.0% | 0 | 0.0% |
| DSA 1 HOUR | 20 | 6 | 1 | 0 | 0.0% | 0 | 0.0% |

Penalty tasks (⚠, negative points) collected **-586 pts** in penalties across 77 trigger logs.
System bonuses (daily completion 5/15, streak +15/7d, league) live in day_summaries: 1 daily-bonus days, 0 streak-bonus days, 93 league-bonus days, 122 league pts — none attributable to a single task.

## 2. Effort-vs-reward (efficiency ranking)

Median efficiency across positive tasks with ≥5 logs: **3.75 pts per exposure-day** · median **9.89 pts per earning log**. (No time data → points-per-minute unavailable; exposure-day = day between a user's first and last activity on the challenge, after the task first appears in logs. For weekly tasks, "pts/earning log" = points per achieved user-week.)

| Rank | Task | Type | Cfg pts | Pts/exposure-day | vs median | Pts/earning log | Flag |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | push-ups | D | 1 | 27.59 | 7.36× | 47.49 | HIGH OUTLIER |
| 2 | Situps | D | 1 | 20.83 | 5.56× | 31.25 | HIGH OUTLIER |
| 3 | 1.5x body weight Protein instake | D | 20 | 12.14 | 3.24× | 19.54 | HIGH OUTLIER |
| 4 | Walking | D | 5 | 12.12 | 3.23× | 20.8 | HIGH OUTLIER |
| 5 | all day meals at home | D | 15 | 9.06 | 2.42× | 14 | HIGH OUTLIER |
| 6 | Gym | W | 100 | 8.79 | 2.34× | 100 | HIGH OUTLIER |
| 7 | No junk food | D | 10 | 6.86 | 1.83× | 9.6 | HIGH OUTLIER |
| 8 | 8 hour sleep last night | D | 10 | 6.04 | 1.61× | 9.89 | HIGH OUTLIER |
| 9 | No sugar | D | 10 | 5.61 | 1.5× | 8.57 | watch |
| 10 | Running | D | 12 | 4.66 | 1.24× | 27.38 | watch |
| 11 | 2L water | D | 5 | 3.75 | 1× | 4.91 | ok |
| 12 | Upskilling (Min 90 mins) | W | 150 | 3.57 | 0.95× | 150 | ok |
| 13 | No phone while eating | D | 5 | 3.56 | 0.95× | 4.85 | ok |
| 14 | Cold shower | D | 5 | 3.24 | 0.86× | 4.59 | ok |
| 15 | Morning - Make your bed | D | 3 | 2.68 | 0.71× | 2.95 | watch |
| 16 | Skin care | D | 3 | 2.59 | 0.69× | 2.95 | watch |
| 17 | Sport | W | 100 | 2.38 | 0.63× | 100 | watch |
| 18 | pull-ups | D | 1 | 2.37 | 0.63× | 12.19 | watch |
| 19 | 1 fruit intake | D | 2 | 1.64 | 0.44× | 1.98 | LOW OUTLIER |
| 20 | Meditation for 30 minutes | D | 5 | 0.77 | 0.21× | 4.29 | LOW OUTLIER |
| 21 | Read book for 30 mins | D | 5 | 0.71 | 0.19× | 3.33 | LOW OUTLIER |

## 3. Difficulty signals

| Task | Type | Earn/interact | Earn/exposure | Avg value (numbers) | Configured pts | Diagnosis |
|---|---|---:|---:|---:|---:|---|
| Cold shower | D | 91.9% | 64.8% | — | 5 | ⚠ EASY + HIGH POINTS |
| Walking | D | 98.8% | 57.6% | 3.5 km | 5 | ⚠ EASY + HIGH POINTS |
| Read book for 30 mins | D | 66.7% | 14.1% | — | 5 | ⚠ HARD + LOW POINTS |
| push-ups | D | 95.1% | 55.2% | 75 reps | 1 | easy, fairly paid |
| Meditation for 30 minutes | D | 85.7% | 15.4% | — | 5 | ⚠ EASY + HIGH POINTS |
| AI systems | W | — | 0.0% | — | 10 | rarely achieved |
| System design 1 hour | W | — | 0.0% | — | 20 | rarely achieved |
| DSA 1 HOUR | W | — | 0.0% | — | 20 | rarely achieved |
| Gym | W | — | 61.5% | — | 100 | neutral |
| pull-ups | D | 81.0% | 15.7% | 23.2 reps | 1 | ⚠ HARD + LOW POINTS |
| Running | D | 68.8% | 11.7% | 2.6 km | 12 | hard, low pay |
| 1 fruit intake | D | 99.2% | 81.8% | — | 2 | easy, fairly paid |
| 2L water | D | 98.2% | 75.0% | — | 5 | ⚠ EASY + HIGH POINTS |
| Upskilling (Min 90 mins) | W | — | 16.7% | — | 150 | rarely achieved |
| Skin care | D | 98.4% | 86.3% | — | 3 | easy, fairly paid |
| Sport | W | — | 16.7% | — | 100 | rarely achieved |
| No sugar | D | 85.7% | 56.1% | — | 10 | ⚠ EASY + HIGH POINTS |
| No junk food | D | 96.0% | 68.6% | — | 10 | ⚠ EASY + HIGH POINTS |
| all day meals at home | D | 93.3% | 60.4% | — | 15 | ⚠ EASY + HIGH POINTS |
| Situps | D | 100.0% | 66.7% | 50 reps | 1 | easy, fairly paid |
| 8 hour sleep last night | D | 98.9% | 60.4% | — | 10 | ⚠ EASY + HIGH POINTS |
| Morning - Make your bed | D | 98.4% | 89.4% | — | 3 | easy, fairly paid |
| 1.5x body weight Protein instake | D | 97.7% | 60.7% | — | 20 | ⚠ EASY + HIGH POINTS |
| No phone while eating | D | 97.0% | 71.1% | — | 5 | ⚠ EASY + HIGH POINTS |

Notes on number tasks: Walking bonus (+15 per 5 km) and Running bonus (+30 per 5 km) are already stored on logs; push-ups pays 1 pt per 2 reps (+25 per 100), pull-ups 1 pt per 1.5 reps, sit-ups 1 pt per 2.5 reps — check whether users ever reach the 100-rep bonus thresholds (see values below).
push-ups values: n=58, avg=75, max=182; pull-ups max=50; sit-ups max=70.

## 4. Distribution and dominance

| Task | Total pts | Share of +pts | Cumulative |
|---|---:|---:|---:|
| push-ups | 2897 | 19.5% | 19.5% |
| 1.5x body weight Protein instake | 1700 | 11.4% | 30.9% |
| Walking | 1685 | 11.3% | 42.2% |
| all day meals at home | 1260 | 8.5% | 50.7% |
| No junk food | 960 | 6.5% | 57.2% |
| 8 hour sleep last night | 900 | 6.1% | 63.2% |
| Gym | 800 | 5.4% | 68.6% |
| No sugar | 780 | 5.2% | 73.8% |
| 2L water | 555 | 3.7% | 77.6% |
| No phone while eating | 480 | 3.2% | 80.8% |
| Running | 438 | 2.9% | 83.8% |
| Morning - Make your bed | 378 | 2.5% | 86.3% |
| Skin care | 360 | 2.4% | 88.7% |
| Cold shower | 340 | 2.3% | 91.0% |
| Upskilling (Min 90 mins) | 300 | 2.0% | 93.0% |
| pull-ups | 256 | 1.7% | 94.7% |
| Situps | 250 | 1.7% | 96.4% |
| 1 fruit intake | 242 | 1.6% | 98.0% |
| Sport | 200 | 1.3% | 99.4% |
| Read book for 30 mins | 60 | 0.4% | 99.8% |
| Meditation for 30 minutes | 30 | 0.2% | 100.0% |
| AI systems | 0 | 0.0% | 100.0% |
| System design 1 hour | 0 | 0.0% | 100.0% |
| DSA 1 HOUR | 0 | 0.0% | 100.0% |

Herfindahl index of task point shares: **0.09** (0.10+ = high concentration). Top-3 share: **42.2%**.
Contribution of tasks with <2% share: pull-ups, Situps, 1 fruit intake, Sport, Read book for 30 mins, Meditation for 30 minutes, AI systems, System design 1 hour, DSA 1 HOUR — these are effectively ignored by the points economy.

Activity concentrates on near-automatic checkboxes, not the highest-paying tasks: the 3 most-logged tasks (Morning - Make your bed, 1 fruit intake, Skin care) take **24.7%** of all logs, while the top-3 efficiency tasks take only 10.4%.

## 5. User-level patterns

totalPoints distribution (all 23 users, incl. 0-point): mean=661.9, median=39, max=2240, min=0, p90=1958, p10=0 (bottom 10% ≈ 9 users, mostly 0).
Top 10% of users (2) hold **28.5%** of all stored points.

| User | totalPoints | Active span (d) | Top task (recomputed pts) | Top-task share | Reconstructed task pts |
|---|---:|---:|---|---:|---:|
| hcmjeq | 2240 | 14 | push-ups (989) | 45.4% | 2180 |
| qcedmf | 2103 | 27 | push-ups (933) | 47.9% | 1949 |
| 89y71t | 1958 | 14 | Walking (525) | 27.5% | 1911 |
| ya284a | 1893 | 14 | Upskilling (Min 90 mins) (300) | 16.8% | 1782 |
| hvs4hb | 1781 | 14 | Walking (325) | 20.3% | 1604 |
| dgwp45 | 1506 | 14 | push-ups (364) | 26.6% | 1367 |
| 038o1m | 1186 | 14 | Walking (475) | 41.3% | 1150 |
| 6kx3zf | 1036 | 14 | No junk food (140) | 15.3% | 914 |

New vs experienced (veteran = account ≥21 days old at data end, n=7 active):

| Task (≥10 logs each group) | Veteran pts/exposure-day | New pts/exposure-day | Gap |
|---|---:|---:|---:|
| Cold shower | 3.71 | 2.29 | -1.43 |
| Walking | 9.63 | 15.51 | 5.88 |
| push-ups | 38.94 | 4.89 | -34.06 |
| 1 fruit intake | 1.7 | 1.56 | -0.14 |
| 2L water | 4 | 3.46 | -0.54 |
| Skin care | 2.51 | 2.69 | 0.18 |
| No sugar | 6.38 | 4.58 | -1.8 |
| No junk food | 6.88 | 6.83 | -0.04 |
| all day meals at home | 7.31 | 11.44 | 4.13 |
| 8 hour sleep last night | 6.38 | 5.65 | -0.72 |
| Morning - Make your bed | 2.74 | 2.6 | -0.14 |
| 1.5x body weight Protein instake | 12.1 | 12.2 | 0.1 |
| No phone while eating | 3.33 | 3.77 | 0.43 |

Exploitation checks:
- Duplicate user-task-day logs: **0** (DB unique constraint holds).
- Recomputed daily habit points/user-day: mean=96.2, max=201, p99=193.
- Penalty triggers: Drank Alcohol n=4, Ciggerate n=12, Total screen time above 3 hours n=52, Masturbation n=9.

## 6. Trends over time (weekly)

| Week | Logs (all) | Earning daily logs | Task pts (daily recompute) | Day-summary pts | Users active |
|---|---:|---:|---:|---:|---:|
| 2026-09-21 | 5 | 0 | 0 | 0 | 1 |
| 2026-10-05 | 790 | 692 | 6505 | 6899 | 13 |
| 2026-10-12 | 711 | 643 | 6480 | 7024 | 12 |

Per-task momentum (last two weeks with logs, daily tasks with ≥5 logs in either week):

| Task | Prev-week logs | Last-week logs | Direction |
|---|---:|---:|---|
| Cold shower | 38 | 36 | ➡ stable |
| Walking | 46 | 35 | 📉 falling |
| Read book for 30 mins | 12 | 6 | 📉 falling |
| push-ups | 33 | 28 | ➡ stable |
| Meditation for 30 minutes | 6 | 1 | 📉 falling |
| pull-ups | 13 | 8 | 📉 falling |
| Running | 10 | 6 | 📉 falling |
| 1 fruit intake | 63 | 59 | ➡ stable |
| 2L water | 58 | 55 | ➡ stable |
| Skin care | 62 | 60 | ➡ stable |
| No sugar | 42 | 49 | ➡ stable |
| No junk food | 53 | 47 | ➡ stable |
| all day meals at home | 42 | 48 | ➡ stable |
| Ciggerate | 6 | 6 | ➡ stable |
| Total screen time above 3 hours | 33 | 19 | 📉 falling |
| Situps | 0 | 8 | 📈 rising |
| 8 hour sleep last night | 49 | 42 | ➡ stable |
| Morning - Make your bed | 66 | 62 | ➡ stable |
| Masturbation | 6 | 3 | 📉 falling |
| 1.5x body weight Protein instake | 47 | 40 | ➡ stable |
| No phone while eating | 52 | 47 | ➡ stable |

## 7. Reward-band classification (descriptive)

Tasks grouped by measured efficiency vs the 3.75 pts/exposure-day median. Labels describe the data only — no point changes are proposed.

| Task | Cfg pts | Band | Evidence | Sample size |
|---|---:|---|---|---|
| push-ups | 1 | **Above band** | 27.59 pts/exposure-day = 7.36× median; earn rate 55.2% | 61 logs |
| 1.5x body weight Protein instake | 20 | **Above band** | 12.14 pts/exposure-day = 3.24× median; earn rate 60.7% | 87 logs |
| Walking | 5 | **Above band** | 12.12 pts/exposure-day = 3.23× median; earn rate 57.6% | 81 logs |
| all day meals at home | 15 | **Above band** | 9.06 pts/exposure-day = 2.42× median; earn rate 60.4% | 90 logs |
| No junk food | 10 | **Above band** | 6.86 pts/exposure-day = 1.83× median; earn rate 68.6% | 100 logs |
| 8 hour sleep last night | 10 | **Above band** | 6.04 pts/exposure-day = 1.61× median; earn rate 60.4% | 91 logs |
| No sugar | 10 | **Edge of band** | 5.61 pts/exposure-day = 1.5× median; earn rate 56.1% | 91 logs |
| 2L water | 5 | **In band** | 3.75 pts/exposure-day = 1× median; earn rate 75.0% | 113 logs |
| No phone while eating | 5 | **In band** | 3.56 pts/exposure-day = 0.95× median; earn rate 71.1% | 99 logs |
| Running | 12 | **Edge of band** | 4.66 pts/exposure-day = 1.24× median; earn rate 11.7% | 16 logs |
| Morning - Make your bed | 3 | **Edge of band** | 2.68 pts/exposure-day = 0.71× median; earn rate 89.4% | 128 logs |
| Skin care | 3 | **Edge of band** | 2.59 pts/exposure-day = 0.69× median; earn rate 86.3% | 122 logs |
| Cold shower | 5 | **In band** | 3.24 pts/exposure-day = 0.86× median; earn rate 64.8% | 74 logs |
| pull-ups | 1 | **Edge of band** | 2.37 pts/exposure-day = 0.63× median; earn rate 15.7% | 21 logs |
| Situps | 1 | **Above band** | 20.83 pts/exposure-day = 5.56× median; earn rate 66.7% | 8 logs |
| 1 fruit intake | 2 | **Below band** | 1.64 pts/exposure-day = 0.44× median; earn rate 81.8% | 122 logs |
| Read book for 30 mins | 5 | **Below band** | 0.71 pts/exposure-day = 0.19× median; earn rate 14.1% | 18 logs |
| Meditation for 30 minutes | 5 | **Below band** | 0.77 pts/exposure-day = 0.21× median; earn rate 15.4% | 7 logs |
| Drank Alcohol | -10 | **No data** | only 4 logs — not classifiable | 4 logs |
| Masturbation | -10 | **Penalty** | 9 triggers logged; 60 pts removed in total | 9 logs |
| Ciggerate | -10 | **Penalty** | 12 triggers logged; 110 pts removed in total | 12 logs |
| Total screen time above 3 hours | -3 | **Penalty** | 52 triggers logged; 396 pts removed in total | 52 logs |
| Gym | 100 | **Above band** | 8.79 pts/exposure-day = 2.34× median; earn rate 61.5% (target 4/wk) | 13 user-weeks |
| Upskilling (Min 90 mins) | 150 | **In band** | 3.57 pts/exposure-day = 0.95× median; earn rate 16.7% (target 5/wk) | 12 user-weeks |
| Sport | 100 | **Edge of band** | 2.38 pts/exposure-day = 0.63× median; earn rate 16.7% (target 4/wk) | 12 user-weeks |
| AI systems | 10 | **No data** | only 1 user-weeks — not classifiable | 1 user-weeks |
| System design 1 hour | 20 | **No data** | only 1 user-weeks — not classifiable | 1 user-weeks |
| DSA 1 HOUR | 20 | **No data** | only 1 user-weeks — not classifiable | 1 user-weeks |

## Data gaps and assumptions

- No `attempts`, `time_taken`, `difficulty`, or task `createdAt` columns exist — completion-rate and points-per-minute from your template are proxied; task availability uses first-log-date as a proxy (tasks added mid-challenge will look artificially low early on).
- `challenge_tasks` has no creation timestamp; exposure windows may slightly over/under-count for late-added tasks.
- Logs are sparse (users log only what they do), so "earn/interact" overestimates true compliance; exposure-day rates are the fairer number.
- System bonuses (daily-completion 5/15, streak +15, league) are aggregated in `day_summaries` and cannot be attributed to individual tasks — excluded from per-task totals.
- `users.totalPoints` (mean/median above) includes bonuses and weekly credit; reconstructed task-point totals will be lower by the bonus amount. Sample: 23 users / 1,506 logs / ~4.5 weeks — small; bands marked "No data" or small samples need more weeks to classify reliably.
- The DSA challenge ("6 month DSA + system design") has very few logs vs Winter Arc 2026; its weeklies are not classifiable.
