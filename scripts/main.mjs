import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";
import { DatentraegerDaten } from "./datenmodell.mjs";
import { DatentraegerSheet, oeffneLeserFenster } from "./sheet.mjs";
import { registriereEinstellungen, wendeBewegungAn } from "./einstellungen.mjs";
import { registriereSocket, fuerAlleAbspielen, fuerAlleStoppen } from "./audio.mjs";
import { registriereFenster } from "./fenster.mjs";
import { letzterDualityWurf, zeigenDialog } from "./zeigen.mjs";
import * as syntax from "./syntax.mjs";
import * as sicht from "./sicht.mjs";
import * as leser from "./leser.mjs";
import { cordexText, cordexHtml } from "./cordex.mjs";
import { zieheAlteDatenUm } from "./umzug.mjs";

Hooks.once("init", () => {
  CONFIG.JournalEntryPage.dataModels[SEITEN_TYP] = DatentraegerDaten;

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.JournalEntryPage,
    MODUL_ID,
    DatentraegerSheet,
    { types: [SEITEN_TYP], makeDefault: true, label: "DATENTRAEGER.Sheet" }
  );

  registriereEinstellungen();
  registriereFenster();

  // Für Makros und zum Nachsehen in der Konsole: game.modules.get("motherboard-data-carrier-journal").api
  game.modules.get(MODUL_ID).api = {
    syntax, sicht, leser, cordexText, cordexHtml,
    oeffneLeserFenster, fuerAlleAbspielen, fuerAlleStoppen, letzterDualityWurf, zeigenDialog
  };
});

Hooks.once("ready", () => {
  registriereSocket();
  wendeBewegungAn();
  zieheAlteDatenUm();
});
