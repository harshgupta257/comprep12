# ComPrep 12

Offline study app (PWA) for CBSE Class 12 Commerce with Maths: Accountancy, Business Studies,
English Core, Applied Mathematics and Economics. Plain HTML, CSS and JavaScript; no build step.

## Run locally

    python -m http.server 5173

Then open http://localhost:5173

## Put it online with GitHub Pages (free)

1. Create a free account at github.com and a new **public** repository, for example `comprep12`
   (leave it empty: no README, no licence).
2. In this folder run, replacing YOUR-NAME:

       git remote add origin https://github.com/YOUR-NAME/comprep12.git
       git push -u origin main

3. On GitHub open the repository: Settings, Pages, Source "Deploy from a branch", Branch `main`, folder `/ (root)`, Save.
4. After a minute or two the app is live at https://YOUR-NAME.github.io/comprep12/

## Install on an iPhone

Open the address in **Safari**, tap Share, then "Add to Home Screen". Open the app once while online;
use Settings, "Download all for offline" to keep every chapter. Past papers are saved the first time
each one is opened.

## Releasing an update

Change `VERSION` in `sw.js` (for example v1.2.0 to v1.2.1), commit and push. Installed copies show a
"new version ready" banner.

## Content and sources

- Notes, questions and answers are original and should be checked against the current CBSE curriculum.
- `papers/` holds official CBSE board question papers downloaded from cbse.gov.in; they remain
  CBSE's property. Remove that folder before publishing if you do not want to redistribute them
  (the app then falls back to a link to CBSE's archive).
- Syllabus, sample paper and NCERT rows link to cbseacademic.nic.in and ncert.nic.in.
