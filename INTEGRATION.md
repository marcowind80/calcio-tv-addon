# Integration guide — Italian football TV schedule data

This document is for developers who want to consume this project as a **data
source**, not as a Stremio/Nuvio addon.

The addon answers one question: *which Italian channel or platform is
broadcasting a given football match, and when.* If your addon already provides
the streams but lacks broadcast metadata, this fills that gap.

---

## What the data looks like

`GET /all` returns the full scraped schedule as JSON:

```json
[
  {
    "date": "2026-08-23",
    "time": "16:30",
    "competition": "Serie A",
    "channel": "DAZN / Sky Sport",
    "home": "Frosinone",
    "away": "Juventus",
    "homeCode": "frsn",
    "awayCode": "jvnt",
    "homeNorm": "frosinone",
    "awayNorm": "juventus"
  }
]
```

Field notes:

| Field | Meaning |
| --- | --- |
| `date` | ISO date, `YYYY-MM-DD` |
| `time` | Local kickoff time (Europe/Rome), `HH:MM`, may be `null` |
| `competition` | Competition label as published by the source |
| `channel` | Italian broadcaster(s). May be `null` when the source hasn't published it. **Never guessed.** |
| `home` / `away` | Team names as published (Italian/local spelling) |
| `homeCode` / `awayCode` | Stable short codes from the source, useful as join keys |
| `homeNorm` / `awayNorm` | Lowercased, accent-stripped names — use these for fuzzy matching |

Coverage is Italian-market oriented: Serie A, Serie B, Coppa Italia, plus the
foreign competitions broadcast in Italy (La Liga, Premier League, Champions
League, and so on).

## Other endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /all` | Full schedule (the one you want for integration) |
| `GET /search?team=Juventus` | Upcoming fixtures for one team, enriched via TheSportsDB |
| `GET /search?teamA=X&teamB=Y` | Single fixture between two teams |
| `GET /status` | Health: version, last refresh timestamp, font check |
| `GET /refresh` | Force an immediate re-scrape |
| `GET /manifest.json` | Stremio/Nuvio manifest (if you'd rather use it as an addon) |

CORS is open (`Access-Control-Allow-Origin: *`), so browser-side consumption
works without a proxy.

---

## Matching against your own channel list

`homeNorm` / `awayNorm` are pre-normalised for this purpose. A workable
approach, borrowed from how other sports addons do it:

1. Normalise your channel names and descriptions the same way (lowercase,
   strip accents, collapse non-alphanumerics).
2. Require **both** team names to appear before declaring a match; a single
   city name is a weak signal and produces false positives.
3. Use `competition` and `date`/`time` as tie-breakers when several channels
   look plausible.
4. Treat `channel` from this API as the *expected* broadcaster — it tells you
   which of your sources is the right one, rather than replacing them.

Team naming differs between sources (`Inter` vs `Inter Milan`, `Milan` vs
`AC Milan`). `src/teamAliases.js` holds the alias table and is easy to extend.

---

## Please read this before deploying your own copy

The `channel` field comes from scraping **calciointv.com**, a public Italian TV
guide. There is no free API that provides per-country broadcast rights — this
is the pragmatic workaround, and it carries an obligation.

**Run one shared instance, not one per user.** A single instance re-scrapes
every 30 minutes and caches the result, which is negligible load. Hundreds of
self-hosted copies each hitting the source is not, and the predictable outcome
is an IP block that breaks the integration for everyone. If you need higher
throughput, mirror `/all` into your own cache or database and serve your users
from there.

Other operational notes:

- `REFRESH_MINUTES` (default `30`) controls the background refresh interval.
  Please don't lower it without a reason.
- `SPORTSDB_KEY` defaults to `123`, TheSportsDB's public test key. That is fine
  for personal use; for anything distributed, get your own key and check their
  terms.
- Node.js **20+** is required (a transitive dependency needs the global `File`
  API, absent in Node 18).
- Attribution: the source is credited on generated artwork and in API
  responses (`channelSource`). Please keep it.

## Accuracy

Data is best-effort. When the source hasn't published a broadcaster, `channel`
is `null` and stays `null` — the addon does not infer or guess. Treat a `null`
as "unknown", not as "not broadcast".

## Licence

MIT. See `LICENSE`.
