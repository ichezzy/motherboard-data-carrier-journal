# Datenträger

Foundry-VTT-Modul für *White Signal* (Daggerheart, Foundryborne). Eine neue Journal-Seitenart **Datenträger**: Text mit Lücken, die jeder Charakter anders lesen kann, dazu Audio.

- Foundry **v14** (getestet gegen die API von 14.365–14.370), Daggerheart **2.12.9**
- Reines ESM, kein Build. Tests mit `node --test`.
- Arbeitstitel `datentraeger`. **Achtung:** Die Seitenart heißt intern `<modul-id>.datentraeger`. Ändert sich die Modul-ID, brauchen bestehende Seiten ein Umzugs-Makro.

## Installation auf dem Server

1. Einmal: `tools\ziel.txt` anlegen mit dem Ziel, z. B. `aetherion:/pfad/zu/Data/modules/datentraeger`.
2. Aus dem Repo-Ordner: `powershell -ExecutionPolicy Bypass -File tools\deploy.ps1` – führt die Tests aus und kopiert nur die Moduldateien per `scp`.
3. Beim ersten Mal Foundry neu starten, dann das Modul in der Welt aktivieren. Danach reicht meist F5.

## Benutzen

**Seite anlegen:** Im Journal *Neue Seite* → Typ **Datenträger**. Art wählen (Anthanen · Signal · Modul), Text schreiben, Audio und Bild über den Dateibrowser.

**Lücke markieren:** Text auswählen → **Lücke markieren** → Art der Lücke und wer lesen kann. Das Modul schreibt die Markierung als Text um die Auswahl. Unter dem Editor steht nach dem Speichern eine Prüfliste mit Warnungen bei Tippfehlern.

**Ansicht:** Jeder Spieler sieht die Seite so, wie sein zugewiesener Charakter sie lesen kann. Der GM sieht alles hervorgehoben (Tooltip: Art und Leser) und kann oben auf *so sieht es Spieler X* umschalten.

**Audio:** Jeder kann im Fenster abspielen. Der GM hat *Für alle abspielen* und *Für alle stoppen*.

## Syntax

```
{{unübersetzt: Die Front ist gefallen.}}
{{unübersetzt | Clank: Die Front ist gefallen.}}
{{unübersetzt | Clank, @Erinys: Bergung nach Bedarf.}}
{{übersprochen: Treffpunkt am Mast >> ♪ Der Ticker hält dich wach! ♪}}
{{gesperrt: Kontostand 12 Kn >> Version 3.0 erforderlich}}
{{abgerissen}}
```

- `{{ Art | Leser : Text >> Ersatz }}` – Pflicht sind nur Art und Text.
- **Leser:** `Clank` = Ancestry · `@Erinys` = Charakter (passt auch auf „Erinys Vael“) · `Success with Hope` = Lesestufe (wirkt ab Phase 2). Eine Regel reicht.
- **`>> Ersatz`** bei übersprochen, überschrieben, gesperrt (Standard *Version 3.0 erforderlich*) und befallen.
- **`{{abgerissen}}`** ohne Text: ab hier fehlt alles bis zum Seitenende.
- Groß-/Kleinschreibung egal, `ue` statt `ü` geht. Eine Markierung bleibt in einem Absatz.
- Kollidiert nicht mit Foundry (`[[/r …]]`, `@UUID[…]{…}` dürfen im markierten Text stehen) und lässt sich in Obsidian genauso schreiben.

| Lücke | Wer nicht lesen kann, sieht | Wer lesen kann |
|---|---|---|
| unübersetzt · fremd | Cordex-Zeichen | Klartext |
| zerfallen | dunkle Lücke | – (fehlt für alle) |
| befallen | blau, flackernd, stotternd – oder den Ersatz | Klartext |
| verrauscht | Rauschen ░▒▓ | Klartext |
| übersprochen | den Ersatz (Jingle) | Original |
| abgerissen | nichts mehr, „– Signal verloren –“ | alles |
| gesperrt | die Meldung im Kasten | Klartext |
| geschwärzt | Balken | Klartext |
| überschrieben | nur den Ersatz, unauffällig | Original |
| beschädigt | Zeichensalat | Klartext |

Eine Markierung mit unbekannter Art (Tippfehler) bleibt für Spieler **zu** und wird in der Prüfliste rot gemeldet.

**Cordex-Zeichen:** Ein Wort wird als Ganzes zu 2–5 Zeichen (nicht Buchstabe für Buchstabe, also nicht zu knacken). Gleiches Wort → immer dieselben Zeichen. Phase 1 nutzt geometrische Unicode-Formen als Platzhalter.

## Clank-Regel

Ein Spieler liest eine Stelle mit `Clank`, wenn sein **zugewiesener Charakter** wie Clank liest. Das Modul erkennt es so (eins reicht):

1. Die Ancestry heißt „Clank“ – auch bei Mixed Ancestry („Clank/Elf“).
2. Die Ancestry stammt vom SRD-Clank im Kompendium (`Compendium.daggerheart.ancestries.Item.ed8BoLR4SHOpeV00`) – hält auch nach Umbenennen.
3. Häkchen im Fenster **Leser** (Knopf in der Ansicht oder *Einstellungen → Datenträger → Leser verwalten*): Automatisch · Ja · Nein.

## Geheimhaltung – ehrlich

**Phase 1 filtert im Browser des Spielers.** Der ganze Rohtext, alle Ersatztexte und die GM-Notiz liegen bei jedem Spieler, der die Seite sehen darf. Wer die Entwicklerkonsole öffnet, kann alles lesen.

Nachrüstbar: Die Sicht berechnet `sicht.baueSicht(rohtext, leser)` – ohne Foundry. In Phase 3 läuft dieselbe Funktion beim GM, und Spieler bekommen über den Modul-Socket nur das Ergebnis.

## Entwicklung

```
node --test          # Parser, Sicht, Cordex
```

- `scripts/syntax.mjs` · `sicht.mjs` · `cordex.mjs` · `konstanten.mjs` – ohne Foundry, testbar
- `scripts/leser.mjs` – Ancestry und Charakter aus Foundry lesen
- `scripts/sheet.mjs` – Ansicht und Bearbeiten (`JournalEntryPageHandlebarsSheet`)
- `scripts/markieren.mjs` – Knopf und Dialog; Editor-Zugriff über das `plugins`-Event des `<prose-mirror>` (Listener in `sheet.mjs`, wie Foundrys Text-Sheet)
- `scripts/audio.mjs` – Socket „für alle“
- In der Konsole: `game.modules.get("datentraeger").api`

## Phasen

1. **Grundgerüst** – Seitenart, Markieren, Ansicht je Spieler mit Clank-Regel, Audio, schlichter Skin. ← jetzt
2. Drei Skins mit Animation, eigene Cordex-Zeichen, Rauschteppich, Lesestufe aus dem Duality-Ergebnis.
3. Geheimmodus über den Socket, Journal *Funde*, Item *Datenträger* als Beute.
