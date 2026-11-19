# Sendlog

An offline-first climbing & training log. It's an installable web app (PWA) that keeps everything on your phone: sessions, climbs, attempts, training, photos and videos. It shows your current level, your pyramid, progress over time, and where you could improve.

- **No account, no server, no tracking.** All data lives in your browser's IndexedDB.
- **Works with no signal.** After the first visit the whole app is cached by a service worker.
- **Back up to a single .zip** (data + media) and restore it on any device.

---

## Run it locally

You need Node.js 20+ (LTS is fine).

```bash
npm install
```

```bash
npm run dev        # dev server at http://localhost:5173
```

```bash
npm test           # unit tests: grade conversion, level stats, backup round-trip
```

```bash
npm run build      # production build into dist/
```

```bash
npm run preview    # serve the production build at http://localhost:4173 (service worker active)
```

The service worker only runs in the production build (`build` + `preview`), not in `dev`.

### Check that offline mode works

1. `npm run build && npm run preview`, open http://localhost:4173 once.
2. Stop the preview server (Ctrl-C), or use DevTools → Network → Offline.
3. Reload: the app still loads, and you can start a session and log climbs. Everything is saved to IndexedDB.

---

## Deploy it for free

It's a static site: deploy the `dist/` folder anywhere. It uses hash URLs (`#/climbs`), so no server rewrites are needed.

### Netlify
1. Push this folder to a GitHub repo.
2. Netlify → *Add new site → Import from Git*. Build command `npm run build`, publish directory `dist`.

Or drag-and-drop the `dist/` folder onto https://app.netlify.com/drop.

### Cloudflare Pages
*Workers & Pages → Create → Pages → Connect to Git*. Framework preset **None**, build command `npm run build`, output directory `dist`.

### GitHub Pages
The repo includes `.github/workflows/deploy.yml`. It runs the tests, builds with the right base path (`/<repo-name>/`) and publishes on every push to `main`.

1. Create an empty repo on GitHub, then push:
   ```bash
   git remote add origin https://github.com/<you>/<repo-name>.git
   ```
   ```bash
   git push -u origin main
   ```
2. On GitHub: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
3. Your app appears at `https://<you>.github.io/<repo-name>/` after the workflow finishes.

To build the same thing locally: `BASE_PATH=/your-repo-name/ npm run build`.

Netlify picks up its settings from `netlify.toml`, so you don't need to type anything into its build settings.

> Service workers and installation require **HTTPS**. All three hosts give you HTTPS automatically.

---

## Install it on your phone

Open your deployed URL once **while online**, then:

- **iPhone / iPad (Safari):** tap Share → **Add to Home Screen**. Open Sendlog from the home-screen icon from then on.
- **Android (Chrome):** tap ⋮ → **Install app** (or "Add to Home screen").

After that it opens full-screen and works with no signal.

**Protect your data:** go to *More → Settings → Storage* and tap **Protect my data from eviction**. Browsers are much more willing to grant this once the app is installed. Safari can delete site data for web apps that haven't been opened for a few weeks, so **export a backup regularly**. Sendlog reminds you if it's been more than 14 days.

### Updating
When you deploy a new version, the app updates itself the next time it's opened online. Your data is untouched.

---

## Using it

| Where | What |
|---|---|
| **Log** (centre tab) | Start a session → **+ Log a climb** after each problem/route → **End session** with rating, energy, conditions, notes and photos. You can also pick a past date. |
| Quick log | Type or pick a recent climb (climbs at the current crag come first). Grade chips scroll to your recent level. One tap for the result, +/− for goes. "Save + next" keeps the sheet open. |
| **Home** | Dashboard with filters (date range, discipline, indoor/outdoor, location). |
| **Climbs** | Search and filter all climbs. Projects show goes so far, beta notes and media. |
| **Train** | Training sessions (sets × reps / weight / added weight / hang / rest, RPE), templates, editable exercise library. |
| **More** | Sessions, Locations (country → area → crag, with an offline map), Search, Settings & backup. |

### What the stats mean
- **Hardest onsight / flash / redpoint**: your first ascents only, per discipline, for the last 90 days and all time. Repeats don't count. "Top rope" and "dog" results aren't sends.
- **Consistent grade**: the hardest grade where you've sent at least **3** climbs at that grade or harder in the last 90 days.
- **Goes to send**: total goes on a climb across all sessions, up to and including the redpoint.
- **Style strengths**: the average grade of your sends with each style tag, relative to your overall average (boulders and routes are each normalised separately). Suggestions are generated from these numbers and from your send rate per style.

### Grades
Boulders: Font, V-scale. Routes: French, UK trad (adjectival + technical, e.g. `E2 5c`), YDS, UIAA. Each climb keeps the grade you logged. Choose your display systems in Settings. All conversions come from one editable table: **`src/lib/grades/gradeTable.ts`**. Each row is one step on the difficulty index used by every chart.

### Backup, import, CSV
*Settings → Backup*:
- **Export backup (.zip)**: `sendlog.json` with every record, plus `media/<id>.<ext>` for each photo/video.
- **Import backup**: replaces everything on this device with the backup's contents.
- **CSV**: one row per attempt (joined with climb, session and crag), and one row per training exercise.

### Media
Photos are resized to ≤1600px and re-encoded as WebP (JPEG fallback) on import. Videos are stored as-is. You'll get a warning above 100 MB. Tap a thumbnail for the full-screen viewer (swipe or arrows to move between items).

### Demo data
On first launch Sendlog loads a year of demo data (UK gym bouldering & lead, a Font trip, a Spanish sport trip and a Magic Wood trip, plus training) so you can explore. Tap **Clear demo data** in the banner or in Settings. It removes only demo records, never anything you logged. Outdoor climb grades in the demo are approximate.

---

## Project structure

```
src/
  db/
    types.ts         data schema (Session, Climb, Attempt, TrainingSession, Media, …)
    db.ts            Dexie database + helpers
    defaults.ts      default exercise library
    seed.ts          demo data generator + clear
  lib/
    grades/
      gradeTable.ts  ← THE editable conversion table
      grades.ts      parse / convert / display
    stats.ts         all dashboard calculations (pure functions)
    backup.ts        zip export/import (fflate)
    csv.ts           CSV export
    media.ts         image compression, media import
    storage.ts       persist() + storage estimate
    dates.ts
  components/        UI pieces: AttemptSheet (quick log), charts, media gallery/viewer, pickers
  pages/             Dashboard, Log, Sessions, Climbs, Training, Locations, Search, Settings
  test/              vitest unit tests
scripts/make-icons.mjs  regenerates the PNG app icons (npm run icons)
```

Dependencies: React, Dexie, Recharts, fflate, self-hosted fonts (Instrument Serif + Inter via Fontsource). Build tooling: Vite, vite-plugin-pwa, Vitest.

### Palette
Lemonade `#FBD271` · Sea Blue `#0F4E77` · Matcha `#89A377` · Honey Drizzle `#E7BD8B` · Coffee Grounds `#372516`. Text on Lemonade, Honey and Matcha is always Coffee. Chart bars carry a Coffee outline, because Lemonade and Matcha are low-contrast against the cream background.
