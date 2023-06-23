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

- v0.1.0
  - [x] Mubi → trakt.tv
  - [x] `--since` (accept relative dates)
  - [x] Paginate results
- v1.0.0
  - [ ] Human–friendly error handing
  - [x] Move types shared between files out of `index.mjs`
  - [ ] Auto–detect `--mubi-country`
  - [ ] Netflix → trakt.tv
  - [ ] Mubi → Letterboxd
  - [ ] First two–way sync: trakt.tv ↔︎ Letterboxd
  - [ ] tmdb
  - [ ] imdb
- v1.1.0
  - [ ] Sync ratings
