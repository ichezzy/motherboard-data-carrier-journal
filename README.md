# Motherboard: Data Carrier Journal

Foundry-VTT-Modul für *White Signal* (Daggerheart, Foundryborne). Modul-ID `motherboard-data-carrier-journal`. Eine neue Journal-Seitenart **Datenträger**: Text mit Lücken, die jeder Charakter anders lesen kann, dazu Audio – mit eigenem Skin für jede der drei Arten. Die Oberfläche ist englisch (`lang/en.json`); `lang/de.json` bleibt als deutsche Übersetzung.

- Foundry **v14** (geprüft gegen den Client-Code von 14.365), Daggerheart **2.12.9**
- Reines ESM, kein Build. Tests mit `node --test`.
- Die Seitenart heißt intern `motherboard-data-carrier-journal.datentraeger`. Seiten aus der Zeit des Arbeitstitels `datentraeger` zieht das Modul beim ersten Start selbst um (`scripts/umzug.mjs`).

## Installation auf dem Server

1. Einmal: `tools\ziel.txt` anlegen mit dem Ziel, z. B. `aetherion:/srv/foundry/Data/modules/motherboard-data-carrier-journal`.
2. Aus dem Repo-Ordner: `powershell -ExecutionPolicy Bypass -File tools\deploy.ps1` – führt die Tests aus und kopiert nur die Moduldateien per `scp`.
3. Ein neues Modul braucht einen Neustart von Foundry. Updates: meist reicht F5 in der Welt.

## Benutzen

**Seite anlegen:** Im Journal *Neue Seite* → Typ **Datenträger**. Art wählen (Anthanen · Signal · Modul), Text schreiben, Audio, Rauschteppich und Bild einstellen.

**Lücke markieren:** Text auswählen → **Lücke markieren** → Art der Lücke, wer lesen kann (Ancestry, Charaktere) und ab welchem Ergebnis. Das Modul schreibt die Markierung als Text um die Auswahl. Unter dem Editor steht nach dem Speichern eine Prüfliste mit Warnungen bei Tippfehlern.

**Ansicht:** Jeder Spieler sieht die Seite so, wie sein zugewiesener Charakter sie lesen kann. Der GM sieht alles hervorgehoben (Tooltip: Art und Leser) und hat eine Leiste:
- *Ansicht* – so sieht es Spieler X
- *Leser* – wer liest wie Clank
- *Ergebnis* und **Zeigen…** – das Ergebnis des Wurfs wählen (vorgeschlagen aus dem letzten Duality-Wurf im Chat) und die Seite allen zeigen. Stellen mit Lesestufe werden ab diesem Ergebnis für alle lesbar.

**Skins:** Anthanen – Lichtbänder steigen aus der Scheibe und bauen ein Fenster aus Licht, Zeilen erscheinen nacheinander. Signal – Tuner-Schirm, Wörter steigen aus dem Rauschen über das Limen. Modul – kleiner Bernstein-Schirm, Zeile für Zeile. Der Knopf ↻ baut neu auf.

**Journalfenster als Hologramm:** Zeigt ein Journal eine Datenträger-Seite, wird das Fenster selbst durchsichtig und leuchtet. Einstellung *Journalfenster*: je nach Art (nur Anthanen – Licht in der Luft ist alt) · immer · nie.

**Audio:** Jeder kann im Fenster abspielen; darunter läuft der Rauschteppich (Regler daneben, nur für einen selbst). Der GM hat *Für alle abspielen* und *Für alle stoppen* – mit Rauschteppich bei allen.

**Bewegung:** Einstellung *Bewegung* (System · An · Aus) schaltet alle Animationen ab; „System“ folgt *Bewegung reduzieren* des Betriebssystems.

## Syntax

```
{{untranslated: Die Front ist gefallen.}}
{{untranslated | Clank: Die Front ist gefallen.}}
{{untranslated | Clank, @Erinys: Bergung nach Bedarf.}}
{{untranslated | Success with Hope: Die Kapsel trägt das Siegel der Station.}}
{{crosstalk: Treffpunkt am Mast >> ♪ Der Ticker hält dich wach! ♪}}
{{locked: Kontostand 12 Kn >> Version 3.0 required}}
{{cutoff}}
```

- `{{ Art | Leser : Text >> Ersatz }}` – Pflicht sind nur Art und Text.
- **Leser:** `Clank` = Ancestry · `@Erinys` = Charakter (passt auch auf „Erinys Vael“) · `Success with Hope` = Lesestufe (lesbar ab diesem Ergebnis: Failure with Fear < Failure with Hope < Success with Fear < Success with Hope < Critical Success) · `DC 18` = per Wurf ab diesem Gesamtwert. Eine Regel reicht.
- **Alle Lücken in allen Arten.** Die Art bestimmt Optik und welche Lücken der Markier-Dialog zuerst anbietet.
- **`>> Ersatz`** bei crosstalk, overwritten, locked (Standard *Version 3.0 required*) und infested.
- **`{{cutoff}}`** ohne Text: ab hier fehlt alles bis zum Seitenende.
- Die Lücken heißen englisch (so schreibt sie auch der Markier-Knopf). Die alten deutschen Wörter (unübersetzt, gesperrt …) funktionieren weiter. Groß-/Kleinschreibung egal, `ue` statt `ü` geht. Eine Markierung bleibt in einem Absatz.
- Kollidiert nicht mit Foundry (`[[/r …]]`, `@UUID[…]{…}` dürfen im markierten Text stehen) und lässt sich in Obsidian genauso schreiben.

| Lücke (alt: deutsch) | Wer nicht lesen kann, sieht | Wer lesen kann | Per Wurf (ohne eigenen DC) |
|---|---|---|---|
| untranslated (unübersetzt) · foreign (fremd) | Cordex-Zeichen | Klartext | – (später: Cordex) |
| decayed (zerfallen) | dunkle Lücke | – (fehlt für alle) | nie, auch nicht mit DC |
| infested (befallen) | blau, flackernd, stotternd – oder den Ersatz | Klartext | – (später: Purge) |
| static (verrauscht) | Rauschen ░▒▓ | Klartext | Difficulty der Seite |
| crosstalk (übersprochen) | den Ersatz (Jingle) | Original | Difficulty der Seite |
| cutoff (abgerissen) | nichts mehr, „– signal lost –“ | alles | nur mit eigenem DC |
| locked (gesperrt) | die Meldung im Kasten | Klartext | Difficulty der Seite |
| redacted (geschwärzt) | Balken | Klartext | Difficulty der Seite |
| overwritten (überschrieben) | nur den Ersatz, unauffällig | Original | nur mit eigenem DC |
| corrupted (beschädigt) | Zeichensalat | Klartext | nur mit eigenem DC |

Eine Markierung mit unbekannter Art (Tippfehler) bleibt für Spieler **zu** und wird in der Prüfliste rot gemeldet.

**Cordex-Zeichen:** eigene Schrift aus Bausteinen (5 Grundstriche × 4 Kopfzeichen × 2 Seitenstriche = 40 Zeichen), als SVG mit feiner Leiterbahn unter jedem Wort. Ein Wort wird als Ganzes zu 2–5 Zeichen (nicht Buchstabe für Buchstabe, also nicht zu knacken). Gleiches Wort → immer dieselben Zeichen. `node tools/cordex-vorschau.mjs > cordex.html` zeigt alle Zeichen.

## Clank-Regel

Ein Spieler liest eine Stelle mit `Clank`, wenn sein **zugewiesener Charakter** wie Clank liest. Das Modul erkennt es so (eins reicht):

1. Die Ancestry heißt „Clank“ – auch bei Mixed Ancestry („Clank/Elf“).
2. Die Ancestry stammt vom SRD-Clank im Kompendium (`Compendium.daggerheart.ancestries.Item.ed8BoLR4SHOpeV00`) – hält auch nach Umbenennen.
3. Häkchen im Fenster **Leser** (Knopf in der Ansicht oder *Configure Settings → Motherboard: Data Carrier Journal → Manage Readers*): Automatisch · Ja · Nein.

## Entschlüsseln

Jede Seite hat **Trait** und **Difficulty** (Standard: Knowledge bei Anthanen, Instinct bei Signal, Finesse bei Modul; Difficulty 12). Ein Spieler mit zugewiesenem Charakter drückt **Entschlüsseln** → der normale Daggerheart-Würfeldialog → der Client des GM prüft den Wurf in der Chatnachricht selbst nach und trägt das Ergebnis ein. **Einmal pro Datenträger.** Zuerst sieht nur der Würfelnde das Ergebnis; mit **Für alle freigeben** teilt er es.

**DC pro Stelle (0.5.0):** Der Gesamtwert des Wurfs wird gegen jede Stelle einzeln verglichen – `{{redacted | DC 18: …}}` öffnet sich ab 18, locked, redacted, static und crosstalk ohne eigenen DC ab der Difficulty der Seite. Ein hoher Wurf öffnet also mehr, auch bei einem Misserfolg können Stellen mit niedrigem DC aufgehen. Beim **Show…** setzt der GM optional einen Gesamtwert für alle (vorgeschlagen aus dem letzten Duality-Wurf); ohne ihn zählt bei einem Erfolg die Difficulty. Failure with Hope lässt nie eine Stelle zerfallen, die der Wurf gerade geöffnet hat.

| Ergebnis | Der Würfelnde liest | Was mit dem Träger passiert |
|---|---|---|
| Critical Success | alle Stellen mit Lesestufe | nichts |
| Success with Hope | bis Success with Hope | nichts |
| Success with Fear | bis Success with Fear | **Preis:** nur der GM sieht den Text aus dem Feld *Preis* (leer = Standard je Art) |
| Failure with Hope | nur Stellen „ab Failure with Hope“ + Text aus *Hinweis* | **eine Stelle zerfällt** – für alle, dauerhaft |
| Failure with Fear | nichts | **zerstört** – für alle unleserlich, auch für Clank |

Daggerheart erledigt Hope, Fear und Stress selbst. Der GM kann einen Datenträger **zurücksetzen**.

## Funde und Beute

- **Journal „Funde“:** wird beim ersten Fund angelegt (für Spieler lesbar) und bekommt eine Seite je Datenträger – mit dem, was die **ganze Gruppe** gesehen hat: beim „Zeigen…“ durch den GM und beim „Für alle freigeben“. Was nur Clank lesen kann, steht dort nicht. Cordex steht als Platzhalter darin, nie das Wort.
- **Beute:** Knopf in der GM-Leiste legt ein Daggerheart-Loot-Item an, das auf die Seite zeigt. Im Item-Bogen erscheint **Datenträger lesen**. Damit Spieler die Seite öffnen können, setzt das Modul das Journal auf „Beobachter“. Das Item bekommt das Icon seiner Art (Disk, Empfänger, Chip – `assets/icons/`), außer die Seite hat ein eigenes Bild.

## Auf der Karte

- **Hinlegen:** Eine Datenträger-Seite (oder ihr Beute-Item) aus dem Journal auf die Karte ziehen. Es entsteht ein Tile mit dem Icon der Art, eingerastet auf die Feldmitte (mit Shift genau an der Stelle). Es liegt zuerst **versteckt** da.
- **Aufdecken:** Rechtsklick auf das Tile → **Auge**.
- **Finden:** Spieler doppelklicken das aufgedeckte Tile. Sie müssen es sehen können (kein Nebel, keine Wand dazwischen), und ihr Token muss in Reichweite **Very Close** stehen – so, wie Daggerheart sie für die Szene einstellt (Standard 15 ft). Ein verstecktes Tile reagiert nicht.
- **Lesen** öffnet die Seite. **Einstecken** fragt den GM: Sein Browser prüft Token, Reichweite und Tile selbst nach, legt das Beute-Item beim Charakter an und nimmt das Tile von der Karte. Der GM muss dafür online sein.

## Geheimhaltung – ehrlich

Foundry 14 schickt **jedem** Benutzer alle Journale, alle Einstellungen und die Inhalte aller Kompendien – Rechte verstecken nur in der Oberfläche (im Server-Code geprüft).

**Geheimmodus** (*Configure Settings → Motherboard: Data Carrier Journal → Secret Mode*): Text, GM-Notiz, Preis und Hinweis liegen nur **verschlüsselt** in der Welt (AES-GCM, Schlüssel aus deinem Geheimwort per PBKDF2). Das Geheimwort bleibt in deinem Browser und erreicht nie den Server. Spieler fragen deinen Client per `User#query` – der Server leitet die Anfrage nur an dich weiter und nennt dir den echten Absender – und bekommen nur ihre eigene Sicht zurück. **Der GM muss online sein** und das Geheimwort in seinem Browser eingegeben haben.

- Schreib das Geheimwort auf – ohne es lassen sich verschlüsselte Seiten nicht mehr öffnen.
- Auf einem anderen Gerät: im Fenster *Geheimmodus* einmal eingeben.
- Was ein Spieler einmal gesehen hat, liegt in seinem Browser – das ist gewollt.
- Name, Art, Bild und Audio einer Seite sind nicht verschlüsselt (Dateien in Foundrys Datenordner sind für jeden abrufbar).
- Ohne Geheimmodus gilt das Verhalten aus Phase 1: Filtern im Browser, über die Entwicklerkonsole lesbar.

## Entwicklung

```
node --test                      # Parser, Sicht, Cordex, Lesestufe, Karte
node tools/cordex-vorschau.mjs   # alle Cordex-Zeichen als HTML
```

`tools/vorschau.html` zeigt die drei Skins samt Animation und Hologramm-Fenster ohne Foundry – über einen lokalen Webserver aus dem Repo-Ordner öffnen (z. B. `npx http-server .` → `/tools/vorschau.html`).

- `scripts/syntax.mjs` · `sicht.mjs` · `cordex.mjs` · `wurf.mjs` · `konstanten.mjs` – ohne Foundry, testbar
- `scripts/leser.mjs` – Ancestry und Charakter aus Foundry lesen
- `scripts/sheet.mjs` – Ansicht und Bearbeiten (`JournalEntryPageHandlebarsSheet`; die Ansicht absichtlich ohne `root: true`)
- `scripts/markieren.mjs` – Knopf und Dialog; Editor-Zugriff über das `plugins`-Event des `<prose-mirror>` (Listener in `sheet.mjs`, wie Foundrys Text-Sheet)
- `scripts/zeigen.mjs` – Lesestufe, letzter Duality-Wurf, „Zeigen…“
- `scripts/animation.mjs` · `fenster.mjs` – Aufbau-Animation und Hologramm-Fenster
- `scripts/audio.mjs` · `rauschen.mjs` – Socket „für alle“, Rauschteppich (Web Audio)
- `scripts/krypto.mjs` · `geheim.mjs` · `geheim-fenster.mjs` – Geheimmodus
- `scripts/anfragen.mjs` – Anfragen an den GM (Sicht, Entschlüsseln, Freigeben)
- `scripts/seite.mjs` – Flags einer Seite und die Sicht für einen Benutzer
- `scripts/entschluesseln.mjs` · `funde.mjs` · `beute.mjs`
- `scripts/karte.mjs` · `karte-logik.mjs` – Datenträger als Tile auf der Karte (Geometrie ohne Foundry, testbar)
- In der Konsole: `game.modules.get("motherboard-data-carrier-journal").api`

## Phasen

1. **Grundgerüst** – Seitenart, Markieren, Ansicht je Spieler mit Clank-Regel, Audio, schlichter Skin. ✔
2. **Skins** – drei Skins mit Animation, Hologramm-Fenster, eigene Cordex-Zeichen, Rauschteppich, Lesestufe aus dem Duality-Ergebnis. ✔
3. **Geheimmodus und Entschlüsseln** – verschlüsselter Volltext, Sicht vom GM, Entschlüsseln-Wurf mit Konsequenzen, Journal *Funde*, Beute-Item. ✔
   - 0.4.0: Datenträger auf der Karte – hinlegen, aufdecken, finden, lesen, einstecken.
   - 0.4.1: Name „Motherboard: Data Carrier Journal“, Oberfläche und Lücken-Wörter englisch.
   - 0.5.0: DC pro Stelle, alle Lücken in allen Arten. ← jetzt
4. **Schlüssel** (geplant): Zugangskarten mit Level und Aussteller · eigenes Kompendium · Cordex-Level (nur der GM setzt sie, Clanks Level 1, Translate) · infested mit Purge-Wurf, Purge Chip und Skip.
5. Text aus Audio: Skript an der Aufnahme ausrichten (Forced Alignment), Lücken im Ton je Zuhörer.
