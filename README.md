# DexLab — Pokémon Advanced Search

A static React web app for exploring Pokémon, building Showdown teams, and checking defensive coverage. Ready for GitHub Pages; no backend, account, or API key required.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open the localhost URL Vite prints. `npm test` runs the domain/data tests. `npm run build` produces `dist/`; `npm run preview` previews that production build. Do not open `index.html` through a `file://` URL.

## Host on GitHub Pages

1. Push this project to a GitHub repository on `main` or `master`.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. The included **Deploy DexLab to GitHub Pages** workflow tests, builds, and deploys the app. It also supports manual runs in the Actions tab.

Vite uses relative asset URLs, so both repository Pages (`username.github.io/repository/`) and custom domains work. The application uses in-page navigation, so no SPA rewrite or 404 workaround is needed. `dist/` is also deployable to any static host. No GitHub repository or remote has been created by this project setup.

## Features

- National Dex, Champions VGC Regulation M-C, and archived Regulation M-B pools.
- Search by name or Pokédex number; combine two required types, an ability, multiple learned moves, and multiple type conditions. Resists includes immunities; Strong against matches a Pokémon's own types against a single defending type (for example, Grass or Electric against Water). Defensive filters can account for one available ability, with cautions for ability-dependent results.
- All seven stat columns and Name sort descending first, then ascending. Types and Abilities headings open filters.
- Pokémon details, base stats, ability descriptions, all 18 defensive matchups, and on-demand competitive usage.
- Multiple locally saved teams with six slots; nickname, item, ability, nature, level, gender, shiny, EVs/IVs or Champions stat points, Tera type, and happiness.
- Species-specific move picker with type/category filters, name/power/accuracy sorting, and stackable Spread, Sound, Sharpness, Sheer Force, Speed Control, and Priority filters.
- Speed Control includes turn-order moves and guaranteed Speed/paralysis effects on a successful hit, subject to target eligibility. Chance-based effects such as Thunderbolt's paralysis are excluded.
- Showdown text import, clipboard export, and `.txt` download. Imports validate before replacing team members.
- Team profile with calculated speed, an 18-type defensive matrix, and potential offensive threats.
- Responsive layout, keyboard-searchable option lists, native modal focus handling, reduced-motion support, and source attribution.
- Top-bar theme selector: Classic, Daylight (light mode), Violet, and Ocean. Theme preferences are saved locally in the browser, independently of teams.

## Game data and updates

`public/data/dex.json` is a **committed snapshot**, generated from Pokémon Showdown commit `a5df8274e85b0889bf2a9b3422a08b39732374fc` on 26 September 2026. It includes format-specific stats, items, abilities, moves, learnsets, descriptions, and type charts. It does not rely on hundreds of live PokéAPI calls.

- [Pokémon Showdown source](https://github.com/smogon/pokemon-showdown)
- [Showdown format definitions](https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts)
- [Official Regulation M-C announcement](https://champions-news.pokemon-home.com/en/page/816.html)
- [Official eligible Pokémon list](https://champions-news.pokemon-home.com/en/page/816.html) (follow “Eligible Pokémon”)

M-C runs 9 September–2 December 2026; M-B is an archived pool. The format lists are derived from Showdown's Champions mods and validator rules, not from singles tier labels. Counts include cosmetic, alternate, and battle-only forms. A released species' declared abilities are retained even when upstream globally tags a battle-only ability as Future (e.g. Aura Guard). National Dex means an unrestricted research pool of official Pokémon and historical items, with Gen 9 calculations and transfer learnsets, rather than a specific National Dex tournament format. Past-generation move combinations and event-source restrictions require full Showdown validation.

Regenerate the pinned snapshot (requires Git and network access on first run):

```sh
npm run data:refresh
```

To deliberately fetch the latest upstream source:

```sh
npm run data:refresh -- --latest
npm test
npm run build
```

Review the resulting snapshot and update the script's `PIN` and format definitions before committing an update. The upstream `champions` mod tracks current rules; when a new regulation arrives, give it a new format ID and retain the appropriate historical mod. Normal installs and Pages builds use the included JSON and need no data refresh. An upstream source checkout lives in the ignored `.data-source/` directory. Showdown's MIT license is included under `public/licenses/`.

## Live usage data

Champions reports are fetched on demand from [Pokémon Champions Battle Data](https://championsbattledata.com/api_guide), with attribution as required by [its API rules](https://championsbattledata.com/api-rules/). Results stay in memory for one hour. No permanent mirror or redistribution of the API feed is included. M-C uses the provider's current doubles report; it is labeled as the provider's latest sample because its endpoint does not supply an observation date. M-B uses the provider's archived M4 sample, additionally checked against M-B's calendar dates. A provider season label alone is not assumed to establish regulation eligibility. When a battle-only form (such as a Mega Evolution) has no separate report (HTTP 404), the app tries its single declared starting form and visibly explains that these percentages are not specific to the selected battle form. It never substitutes the base species for distinct regional or gendered forms, or substitutes data after a server/network error. If neither report exists, it displays a plain-language missing-report message.

National Dex usage comes from [Smogon's monthly National Dex OU ladder reports](https://www.smogon.com/stats/), all ratings. Smogon does not allow cross-origin browser requests, so the app fetches a **dated, normalized snapshot from its own static host**. `npm run usage:refresh` checks the most recent four completed months, downloads the first available report, and keeps the top ten entries per category for each species. The Pages workflow refreshes this report on deployment; if the provider is unavailable it retains the existing dated snapshot. It is not advertised as live data. This sample is explicitly labeled **OU**, even though the app's National Dex search pool is unrestricted. Items, moves, abilities, spreads, natures, and teammates are normalized to the report's weighted set total. Reports may have no data for an uncommon species or form. Missing data and network failures produce an honest empty/error state with retry, never invented percentages.

## Team behavior and limitations

- Teams are automatically saved in **this browser's localStorage**. They do not sync across devices. Export portable backups. Storage failures are surfaced in the UI.
- Champions uses **66 stat points total, 32 per stat**, fixed IVs, and level 50. Its stat formula differs from the main-series EV formula. Showdown encodes these points on the `EVs:` line. Switching between EV and point systems explicitly asks before resetting investment.
- Basic checks cover the selected pool, required items, available abilities/moves, duplicates, and stat budgets. They are **not a tournament legality certificate**. Event requirements and mutually incompatible historical move sources are outside scope.
- Battle-only forms remain selectable to inspect their stats and matchups. They may require an item or an in-battle transformation. Showdown interprets/normalizes battle forms on import; verify your exported team there.
- The defensive profile assumes selected forms without Terastallization. It can account for enumerated passive type immunities/reductions and Air Balloon; it excludes weather, terrain, health-dependent effects, contact conditions, move-specific exceptions, and damage calculations.
- Threats rank **super-effective STAB type coverage**, then BST, and collapse variants of the same base species. They are not usage-weighted and do not predict battle outcomes.
- Speed tiers show calculated stats before item/ability/field/status multipliers; the UI states this explicitly.
- Sprites load from Pokémon Showdown. Unavailable sprites display a Pokédex-number fallback. Google Fonts are optional; system fonts take over if blocked. Core data and editing are served by the host, while sprites/fonts/usage need network access.

## Structure

`src/engine.mjs` contains pure filtering, stat, validation, import/export, and threat logic; `src/api.mjs` handles usage reports. React screens are separated into explorer, builder, profile, details, and moves. `scripts/build-data.mjs` is the reproducible snapshot generator. `tests/` verifies the important domain behavior and dataset invariants. An optional feature-detected WebMCP search action shares the visible explorer state.

Pokémon and related names/artwork belong to Nintendo, Game Freak, Creatures, and The Pokémon Company. DexLab is an unofficial fan project, not endorsed by those companies.
