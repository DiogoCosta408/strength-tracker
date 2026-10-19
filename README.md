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
- **In-session autoregulation**: once you log a set with an RPE, the remaining app-suggested sets re-calculate from today's e1RM. If 5 @ RPE 7 felt like RPE 8, the next jumps get smaller. After a top set that overshoots its target RPE, back-off sets are based on the weight that would have hit the target. Weights you type yourself are never changed.
- **Programs / templates**: built-in templates are Starting Strength, RPE Novice (Barbell Medicine style), GZCLP, Texas Method, 5/3/1 BBB, a 4+1 RPE powerlifting block and a meet peak. You can copy and customize any of them or build your own (weeks → days → exercises → sets). Follow a program and the app queues the next session.
- **Import / export programs**: share templates as `.program.json` files. `scripts/bbm_template_to_program.py` converts a Barbell Medicine weekly template spreadsheet (RPE ramps, load drops, repeats, %e1RM work, GPP) into one.
- **Exercise library**: 225 exercises with competition-lift variations (pause / pin / tempo / SSB / deficit / block / Larsen / Spoto / board…), muscles and equipment. You can add your own.
- **Calculators**:
  - 1RM (7 formulas plus the RPE chart, with a rep-max table)
  - RPE load calculator, back-off from today's top set, and the full RPE chart
  - IPF GL, DOTS, Wilks and Wilks 2020
  - plate calculator
  - meet attempt selector
- **Dashboard**: SBD total and DOTS, the main lifts with 3-month change, an e1RM trend chart, weekly tonnage / hard sets, streak and recent PRs.
- **Strength profile**: an anatomical front/back muscle map coloured by strength level, similar to symmetricstrength.com. It also shows per-lift standards (sex- and age-adjusted), kg needed for the next level, imbalance detection, and manual maxes for meet results.
- **Coach**:
  - **Insights** (offline, automatic): for squat, bench, deadlift and press it detects progressing, stalled and regressing lifts (e1RM trend over 6 weeks, weeks since PR). Likely causes it checks for: RPE drift at the same loads (fatigue), low frequency, low or high weekly volume, too little or too much heavy work, no variations, a finished linear progression, a drop in training frequency, a falling bodyweight, and lifts that lag behind the others. Each finding comes with concrete actions.
  - **Diagnose** (offline): a short interview per lift covering where it fails (e.g. off the chest / mid-range / lockout), what breaks down technically, how heavy reps feel, plus sleep, diet phase and stress. It answers with targeted variations and accessories (sets × reps @ RPE, addable to your program in one tap), technique cues and programming changes.
  - **Ask coach** (AI): a chat with a Claude-powered strength coach. It reads a summary of your last 6 weeks, the lift analysis and your diagnostic answers, asks follow-up questions before prescribing, then gives a plan. It needs your own Anthropic API key, which is stored on the device only.
- **Goals**: target lifts (kg or a strength level), target bodyweight and a date. The coach projects each lift week by week (progress slows as you get stronger and in a calorie deficit, blended with your own trend). It rates each goal on track, ambitious or not realistic, offers an adjusted target or date, and warns about conflicts such as cutting while chasing PRs.
- **Nutrition**: calorie and macro targets for the goal. They start from an estimate (Mifflin-St Jeor × activity); once ~10 days of intake are logged, maintenance is worked out from your intake and weight trend, and calories are adjusted when weight drifts off plan.
- **Bodyweight tracker** with a 7-day moving average and optional daily calories / protein.
- **Share best lifts**: pick which lifts to share. It builds a PNG card (optional total, DOTS/Wilks and muscle map) and opens the native share sheet, or copies the lifts as text.
- **Data**:
  - **Cloud sync**: automatic backup and merge across devices via your own Google Drive (Settings → Cloud sync). See setup below.
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

Data lives in the browser's IndexedDB on that device. Connect **Cloud sync** in Settings to back it up and keep it in sync with your other devices (see below), and/or export a backup regularly from Settings — especially before switching phones or clearing browser data.

## Code map

| Path | What |
|------|------|
| `src/lib/calc.ts` | RPE chart, e1RM formulas, Wilks / Wilks2 / DOTS / IPF GL, plates, warm-ups |
| `src/lib/strength.ts` | Strength standards, scoring, lift → muscle weights, colour ramp |
| `src/lib/stats.ts` | History, bests, rep maxes, PR detection, load suggestions, weekly stats |
| `src/lib/workout.ts` | Starting / finishing workouts from program days, warm-ups, back-offs |
| `src/lib/store.ts` | App state, IndexedDB persistence, lookups |
| `src/lib/coach.ts` | Training analysis: trends, stalls, fatigue, volume/intensity, insights, AI context summary |
| `src/lib/goals.ts` | Goal feasibility, projections, adjusted targets, calorie and macro plan |
| `src/lib/coachAi.ts` | Claude API client for the chat coach (streaming, prompt caching, refusal fallback) |
| `src/lib/merge.ts` | Pure merge logic for cloud sync (union by id, tombstones, last-write-wins) |
| `src/lib/sync.ts` | Sync scheduling and state: debounce, connect/sync/disconnect, snapshots |
| `src/lib/googleAuth.ts` | Google Identity Services OAuth token client (Drive appDataFolder scope) |
| `src/lib/googleDrive.ts` | Drive v3 REST calls, scoped to the hidden appDataFolder |
| `src/lib/googleDriveMock.ts` | Dev-only stand-in for the two above, used with no OAuth client id configured |
| `src/data/coachKnowledge.ts` | Diagnostic questions and weak-point → variation/cue/programming knowledge base |
| `src/data/exercises.ts` | Exercise library |
| `src/data/programs.ts` | Built-in program templates |
| `src/components/BodyMap.tsx` | Anatomical SVG muscle map |
| `src/screens/*` | Screens (Dashboard, Train, Logger, Programs, Tools, Strength, Body, Share, History, Settings) |

## AI coach setup

1. Create an API key at console.anthropic.com.
2. Open **Coach → Ask coach** and paste the key.

Requests go directly from the device to the Claude API (`claude-opus-5-5`, streaming, with the server-side refusal fallback enabled). The key is kept in that browser's localStorage, outside the backup file. Anyone with access to the unlocked device could read it, so use a key with a spending limit.

## Cloud sync setup

Cloud sync stores a backup in a hidden folder in your own Google Drive (`appDataFolder` — not visible in Drive's normal UI, and only this app can read it) and merges per record by id, so new data from two devices is unioned rather than one device's data overwriting the other's. There's no server of any kind involved; it's pure browser-side OAuth.

**1. Google Cloud Console** (one-time, per deployment):

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com) (or reuse one).
2. **APIs & Services → Enabled APIs** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: set it up for **External** users (or Internal if you're on Google Workspace), add the `drive.appdata` scope, and add your own Google account as a test user if the app stays in "Testing" status (fine for personal use — no verification needed since the scope is non-sensitive and limited to the app's own hidden folder).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**. Add **Authorized JavaScript origins**: your Vercel domain (e.g. `https://strength-tracker.vercel.app`) and `http://localhost:5173` for local dev. No redirect URI is needed — this uses the implicit token flow, entirely in the browser.
5. Copy the generated **Client ID**.

**2. App configuration:**

- Local dev: copy `.env.example` to `.env.local` and set `VITE_GOOGLE_CLIENT_ID` to the client id. Restart `npm run dev`. Without this, Settings → Cloud sync falls back to an in-browser mock of Drive (clickable, but nothing really leaves the device) and logs a warning to the console.
- Vercel: in the project's **Settings → Environment Variables**, add `VITE_GOOGLE_CLIENT_ID` with the same value, then redeploy.

**Limitations:** this is a backend-free OAuth flow, so there's no refresh token — the app re-authenticates silently using the browser's existing Google session. If that session is gone (cookies cleared, consent revoked, a long time since last use), Settings will show **Reconnect**; one tap re-opens Google's consent popup. The last 7 daily snapshots are kept in Drive so a bad sync can be rolled back from **Restore snapshot**.

## Notes

- With an RPE, e1RM uses the RTS RPE chart. Without one it uses Epley or Brzycki (configurable).
- For bodyweight exercises (pull-ups, dips…) you log the added weight, and bodyweight is included for e1RM and standards.
- The strength standards are approximations compiled from public strength-standard data. Treat levels as a guide, not a ranking.
- The RPE Novice template is inspired by Barbell Medicine's approach. Their official programs are sold at barbellmedicine.com.
