# NextClass

Shows students their current or next class — course, room, instructor, countdown — plus a
"Not To Do" list for upcoming quizzes, assignments, and homework. Import your school's combined
timetable spreadsheet, pick your section, and NextClass builds your weekly schedule automatically.

Fully offline. No accounts, no cloud sync, no analytics. All data stays on-device in IndexedDB.

**Live app:** https://eepyzoop.github.io/next-class/

## Features

- **Home** — current class in progress (with a progress bar) or the next one coming up
- **Timetable import** — parses a `.xlsx` combined timetable, lets you pick your section, and
  review/adjust individual courses (drop repeats or electives you're not taking, retarget a
  course to a different section) before saving
- **All Classes** — full weekly schedule grouped by day, with per-class or per-course delete
- **Not To Do list** — quizzes, assignments, and homework with due dates, sorted ascending
- **Reminders** — in-app notifications while the app is open, plus optional Web Push for
  reminders while it's closed
- **Installable PWA** — add to home screen on iOS or Android, works fully offline
- **Themes** — a handful of dark, glass-panel color themes

## Stack

React + TypeScript + Vite, `vite-plugin-pwa` for the service worker/offline caching, `idb` for
storage, `sheetjs/xlsx` for parsing, `react-router` for navigation. The optional Web Push
backend is a small Cloudflare Worker + KV (see `worker/`).

## Development

```sh
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build
```

Deploys automatically to GitHub Pages on push to `main`.

## Inspiration

NextClass was built as a rebuild of [**@sanecodeguy**](https://github.com/sanecodeguy)'s
original jailbroken iOS app of the same name — reimagined here as an installable, offline-first web app
with my own tweaks and additional features along the way, for both android and ios.
