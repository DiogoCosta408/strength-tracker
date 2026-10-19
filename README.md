# Strength Tracker

A mobile-first strength training log for powerlifters and barbell athletes. It runs as an installable PWA (add to home screen on iOS/Android), works offline, and keeps all data on the device.

## Features

- **Workout logger**: sets × kg × reps × RPE, with set types (warm-up, work, top set, back-off, AMRAP). Tick a set to accept the prescription, and the rest timer starts with vibration and a beep. Each exercise shows last session's numbers, best e1RM, a live e1RM per set, plate loading per side and a one-tap warm-up ramp. Workouts can be reordered, exercises replaced, notes added, and a session repeated.
- **Autoregulation**: a prescription can be:
  - `reps @ RPE`: the load comes from your recent (6-week) e1RM via the RTS RPE chart.
  - `% of e1RM`
  - fixed kg
  - `% of today's top set`, for load-drop back-offs
  - linear progression (`+kg` after a successful session; repeat the load after a miss)
- **Programs / templates**: built-in templates are Starting Strength, RPE Novice (Barbell Medicine style), GZCLP, Texas Method, 5/3/1 BBB, a 4+1 RPE powerlifting block and a meet peak. You can copy and customize any of them or build your own (weeks → days → exercises → sets). Follow a program and the app queues the next session.
- **Exercise library**: 225 exercises with competition-lift variations (pause / pin / tempo / SSB / deficit / block / Larsen / Spoto / board…), muscles and equipment. You can add your own.
- **Calculators**:
  - 1RM (7 formulas plus the RPE chart, with a rep-max table)
  - RPE load calculator, back-off from today's top set, and the full RPE chart
  - IPF GL, DOTS, Wilks and Wilks 2020
  - plate calculator
  - meet attempt selector
- **Dashboard**: SBD total and DOTS, the main lifts with 3-month change, an e1RM trend chart, weekly tonnage / hard sets, streak and recent PRs.
- **Strength profile**: an anatomical front/back muscle map coloured by strength level, similar to symmetricstrength.com. It also shows per-lift standards (sex- and age-adjusted), kg needed for the next level, imbalance detection, and manual maxes for meet results.
- **Bodyweight tracker** with a 7-day moving average.
- **Share best lifts**: pick which lifts to share. It builds a PNG card (optional total, DOTS/Wilks and muscle map) and opens the native share sheet, or copies the lifts as text.
- **Data**:
  - export/import a JSON backup, either as a file or as copied text
  - CSV export of all sets
  - demo data, for trying the app out

## Run locally

```bash
cd strength-tracker
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the formulas
npm run build      # static build in dist/
```

## Install on your phone

Deploy `dist/` to any static HTTPS host, such as GitHub Pages, Netlify, Cloudflare Pages or Vercel. The build uses relative paths, so it also works from a sub-path. Then open the site on your phone and choose **Add to Home Screen** (Safari share menu on iOS, Chrome menu on Android). The service worker caches the app so it works offline at the gym.

Data lives in the browser's IndexedDB on that device. Export a backup regularly from Settings, especially before switching phones or clearing browser data.

## Code map

| Path | What |
|------|------|
| `src/lib/calc.ts` | RPE chart, e1RM formulas, Wilks / Wilks2 / DOTS / IPF GL, plates, warm-ups |
| `src/lib/strength.ts` | Strength standards, scoring, lift → muscle weights, colour ramp |
| `src/lib/stats.ts` | History, bests, rep maxes, PR detection, load suggestions, weekly stats |
| `src/lib/workout.ts` | Starting / finishing workouts from program days, warm-ups, back-offs |
| `src/lib/store.ts` | App state, IndexedDB persistence, lookups |
| `src/data/exercises.ts` | Exercise library |
| `src/data/programs.ts` | Built-in program templates |
| `src/components/BodyMap.tsx` | Anatomical SVG muscle map |
| `src/screens/*` | Screens (Dashboard, Train, Logger, Programs, Tools, Strength, Body, Share, History, Settings) |

## Notes

- With an RPE, e1RM uses the RTS RPE chart. Without one it uses Epley or Brzycki (configurable).
- For bodyweight exercises (pull-ups, dips…) you log the added weight, and bodyweight is included for e1RM and standards.
- The strength standards are approximations compiled from public strength-standard data. Treat levels as a guide, not a ranking.
- The RPE Novice template is inspired by Barbell Medicine's approach. Their official programs are sold at barbellmedicine.com.
