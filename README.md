# Motherboard: Data Carrier Journal

A Foundry VTT module for the *White Signal* campaign (Daggerheart by Foundryborne). It adds a journal page type, **Data Carrier**: text with gaps that each character reads differently, optional audio, decryption rolls with consequences, and data carriers players can find on the map.

- Foundry **v14** (checked against the 14.365 client code), Daggerheart **2.12.9**
- Plain ES modules, no build step. Tests: `node --test`
- Module ID `motherboard-data-carrier-journal`, page type `motherboard-data-carrier-journal.datentraeger`

> **Work in progress.** Version 0.6 will simplify the gap system (two carrier types, the same five gap categories for both). See *Roadmap*.

## Installation

In Foundry: **Add-on Modules → Install Module →** paste this manifest URL:

```
https://github.com/ichezzy/motherboard-data-carrier-journal/releases/latest/download/module.json
```

Then enable *Motherboard: Data Carrier Journal* in your world.

## Using it

**Create a page:** In a journal, *Add Page* → type **Data Carrier**. Choose the type (Anthanen · Signal · Module), write the text, set audio, noise bed and image.

**Mark a gap:** Select text → **Mark Gap** → gap, who can read it, an optional DC. The module writes the marker as plain text around the selection. After saving, a checklist under the editor warns about typos.

**View:** Each player sees the page the way their character can read it. The GM sees everything highlighted (tooltip: gap and readers) and gets a toolbar: *View as* a player, *Readers*, *Result* and **Show…** (pick the roll result, suggested from the last Duality roll in chat), **Enter Result…**, **Loot**.

**Look:** Each type has its own animated skin; the journal window can turn into a hologram (setting *Journal Window*). *Motion* turns animations off.

**Audio:** Everyone can play it in the window, with a quiet noise bed underneath. The GM can *Play for Everyone*.

## Marker syntax

```
{{untranslated: The front has fallen.}}
{{untranslated | Clank, @Erinys: Salvage on demand.}}
{{redacted | DC 18: Name of the client}}
{{locked | Level 2: Balance 12 Kn >> Version 3.0 required}}
{{cutoff}}
```

- `{{ gap | readers : text >> replacement }}` – only gap and text are required.
- **Readers** (one rule is enough): `Clank` = ancestry · `@Erinys` = character · `Success with Hope` = readable from this roll result on · `DC 18` = readable from this decryption total on · `Level 2` = readable with an access card of level 2+.
- `>> replacement` for crosstalk, overwritten, locked (default *Version 3.0 required*) and infested.
- Gap words are English; the old German words still work. Case doesn't matter. A marker stays inside one paragraph. Foundry syntax (`[[/r …]]`, `@UUID[…]{…}`) may appear inside.

| Gap | Who can't read it sees | Opens by roll without own DC |
|---|---|---|
| untranslated · foreign | Cordex glyphs | – |
| decayed | dark gap (missing for everyone) | never |
| infested | blue, flickering, stuttering text | – |
| static | noise ░▒▓ | page Difficulty |
| crosstalk | the replacement (jingle) | page Difficulty |
| cutoff | nothing from here on | only with own DC |
| locked | the message box | page Difficulty |
| redacted | black bars | page Difficulty |
| overwritten | only the replacement | only with own DC |
| corrupted | character garbage | only with own DC |

**Cordex glyphs:** an own script built from parts (40 glyphs), drawn as SVG with a circuit trace under each word. A whole word becomes 2–5 glyphs, so it can't be decoded letter by letter.

## Decrypting

Each page has a **Trait** and a **Difficulty**. A player presses **Decrypt** → the normal Daggerheart roll dialog → the GM's client checks the roll in the chat message itself and records the result. **Once per data carrier.** At first only the roller sees the result; **Share with Everyone** shares it. The roll total is compared against every passage's DC.

| Result | Consequence for the data carrier |
|---|---|
| Critical Success / Success with Hope | none |
| Success with Fear | **Cost** – only the GM sees the text from the *Cost* field |
| Failure with Hope | one passage decays for everyone; the roller gets the *Hint* |
| Failure with Fear | destroyed – unreadable for everyone |

**Dice at the table:** **Enter Result…** lets the GM record a physical roll (character, total, Hope/Fear/Critical) with the same consequences.

## Findings, loot, the map

- **Findings journal:** gets one page per data carrier with what the whole group has seen (after *Show…* or *Share with Everyone*). It is found by its ID – move or rename it freely.
- **Loot:** creates a loot item pointing to the page (icon by type). The item sheet gets **Read Data Carrier**.
- **On the map:** drag a data carrier page or its loot item onto a scene → a tile, hidden at first (right-click → eye reveals it). Players double-click it within *Very Close* range and can **Read** or **Pick Up**; the GM's client checks token, range and visibility.
- **Unlocking:** whoever picks up or reads a data carrier gets exactly that page (*Observer*, journal *Limited*) – other pages in the same journal stay closed.
- **Access cards:** **Access Card** button at the top of the Items sidebar (GM): level 1–3, optional issuer. Cards are registered in a GM-only setting, so self-made cards don't count.
- **Settings:** folders for created items and journals, size on the map.

## Secrecy – honestly

Foundry v14 sends **every** user all journals, all settings and all compendium contents – permissions only hide things in the interface (checked in the server code).

**Secret Mode** (*Configure Settings → Motherboard: Data Carrier Journal → Secret Mode*): text, GM note, cost and hint are stored **encrypted** in the world (AES-GCM, key derived from your passphrase with PBKDF2). The passphrase stays in your browser and never reaches the server. Players ask your client via `User#query` – the server forwards the request only to you, with the real sender – and get only their own view back. **The GM has to be online** and have entered the passphrase.

- Write the passphrase down – without it, encrypted pages can't be opened again.
- Name, type, image and audio of a page are not encrypted.
- Without Secret Mode, filtering happens in the player's browser and is readable via the developer console.

## Development

```
node --test                        # parser, view, Cordex, rolls, map geometry, access cards
node tools/cordex-vorschau.mjs     # all Cordex glyphs as HTML
```

- **Publish a release:** double-click `Modul veröffentlichen.bat` – runs the tests, checks for uncommitted changes, shows what's new since the last release, asks, then packages the module (`tools/zip.mjs`, no dependencies) and creates a GitHub release with `module.json` and the ZIP. The version comes from `module.json`.
- **Copy to your own server for testing:** `tools/deploy.ps1` (target in `tools/ziel.txt`, not in git, e.g. `myserver:/path/to/foundry/Data/modules/motherboard-data-carrier-journal`).
- `tools/vorschau.html` previews the skins without Foundry.
- Code layout: pure, testable logic in `scripts/syntax.mjs`, `sicht.mjs`, `cordex.mjs`, `wurf.mjs`, `karte-logik.mjs`, `konstanten.mjs`; Foundry glue in the rest (`sheet.mjs` for the page sheet, `anfragen.mjs` for GM queries, `geheim.mjs` + `krypto.mjs` for Secret Mode). Console API: `game.modules.get("motherboard-data-carrier-journal").api`

## Roadmap

1. ✔ Page type, markers, per-reader view, Clank rule, audio
2. ✔ Skins, hologram window, Cordex glyphs, noise bed, read levels from the Duality result
3. ✔ Secret Mode, decryption roll with consequences, Findings, loot, map, DC per passage, manual results, access cards (0.5.2)
4. **0.6 – simplification:** two types (*Anthanen Disc* with audio, always in Cordex · *CTC Module* without audio; Signal pages become Anthanen discs), the same gap categories for both (corrupted · overwritten · redacted · locked · untranslated), automatic unlocking when a character receives the item, a player inbox folder, access cards bound to one module
5. **0.7 – Cordex:** Cordex level 0–3 per character (set by the GM, Clanks start at 1), Translate roll, compendium with the Cordex feature
6. Later: text from audio (forced alignment), gaps in the audio per listener
