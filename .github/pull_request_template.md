<!--
The TITLE of this pull request becomes the squash commit, then the line users
read in CHANGELOG.md and in the GitHub Release. Write it in English, as a
Conventional Commit describing the change for the user:

  feat(widgets): add a weekly view to the consumption widget
  fix: publish the OFF state of a switch
  perf: publish only the readings that changed
  docs: explain how to find the IP address of the Connection Box

feat -> minor version, fix / perf -> patch, `!` or a "BREAKING CHANGE:" footer
-> breaking (a minor while the version is below 1.0.0). docs, chore, ci, test,
style, refactor and build alone publish no release. Never edit CHANGELOG.md.
-->

## What changes for the user

## How it was tested

- [ ] `npm run format:check`, `npm run lint` and `npm test` pass
- [ ] Tried with a real stove and Connection Box (model, firmware):
- [ ] The four docs (`docs/en.md`, `fr`, `de`, `es`) and READMEs are up to date
