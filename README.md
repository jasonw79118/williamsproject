# Williams Project

Static GitHub Pages genealogy research site for the Williams / Lee / Blakely family project.

## Version
v0.2.0

## Major features
- Right-side quick navigation on desktop
- Dark blue theme and dark mode toggle
- Research Targets workspace with editable priority/status, working notes, source links, and copy action
- Add My Family contributor form that downloads a JSON submission for review
- Public-safe living-person UI masking
- GEDCOM-backed project data in `assets/data/project-data.json`

## Privacy warning
This is a static GitHub Pages site. Anything committed into `assets/data/project-data.json` can be viewed directly by the public even if the UI hides it. Review living-person details before publishing.

## Publishing
```powershell
git add .
git commit -m "add contributor workflow and research target workspace"
git push origin main
```
