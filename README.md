# williamsproject

Static genealogy research site for the Williams project.

## What this build includes

Version: v0.1.1

- Public-safe imported data from `Jason Williams Family Tree.ged`
- 816 people and 214 families imported
- Living people masked for public GitHub Pages hosting
- Editable people, notes, research targets, DNA clusters, confidence levels, and generated family-line stories
- Initial DNA cluster tracking for the Jason/Shirley/Devon chromosome 3 triangulated segment
- Source policy honoring the Dan Williams / GW Williams genealogy as most likely unless contradicted
- George W. Williams parentage above George is detached from the confirmed ancestor path and shown as research leads
- Unknown, candidate, hypothesis, conflicting, or imported-only parent links are shown as research leads instead of a confirmed ancestor path

## How edits work

This is a static GitHub Pages site. Browser edits save to localStorage first. To publish edits:

1. Open the site.
2. Make edits.
3. Click **Export JSON**.
4. Replace `assets/data/project-data.json` with the exported `williamsproject-data.json` file.
5. Commit and push to GitHub.

## GitHub Pages

This package includes a no-build GitHub Actions workflow at `.github/workflows/deploy.yml`. The workflow uses `actions/configure-pages@v5` with `enablement: true` to help enable GitHub Pages if it was not already set up.
Create a repository named `williamsproject`, copy these files into the repo root, commit, and push.
Your GitHub Pages URL should be `https://jasonw79118.github.io/williamsproject/`.
Then set GitHub Pages to use GitHub Actions.

## Privacy warning

Do not replace the public JSON with an unredacted GEDCOM export unless you intend to publish living people. The packaged JSON masks living people by default.
