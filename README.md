@saji/movie-sync
================

Sync watch state between different services.

```sh
npx @saji/movie-sync --help
```

Roadmap
-------

Warning: sub par code quality. Expect improvements only after basic set
of features is implemented.

- v0.0.1
  - [x] Proof of concept: Mubi → trakt.tv
  - [x] Config file
  - [x] Introduce verbosity levels, hide requests by default
  - [x] Be more verbose about what’s going on
  - [ ] Check if trakt.tv token is valid before using, refresh
  - [ ] `--since` (accept relative dates)
  - [ ] Paginate results
- v1.0.0
  - [ ] Human–friendly error handing
  - [ ] Make `@typedef`s from `index.mjs` available in other files
  - [ ] Auto–detect `--mubi-country`
  - [ ] Mubi → Letterboxd
  - [ ] Netflix → trakt.tv
  - [ ] First two–way sync: trakt.tv ↔ Letterboxd
  - [ ] tmdb
  - [ ] imdb
- v1.1.0
  - [ ] Sync ratings
