import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";
import { DatentraegerDaten } from "./datenmodell.mjs";
import { DatentraegerSheet, oeffneLeserFenster, ansichtenNeuZeichnen } from "./sheet.mjs";
import { registriereEinstellungen, wendeBewegungAn } from "./einstellungen.mjs";
import { registriereSocket, fuerAlleAbspielen, fuerAlleStoppen } from "./audio.mjs";
import { registriereFenster } from "./fenster.mjs";
import { letzterDualityWurf, zeigenDialog } from "./zeigen.mjs";
import { registriereGeheimEinstellungen, ladeSchluessel, geheimStand } from "./geheim.mjs";
import { GeheimFenster } from "./geheim-fenster.mjs";
import { registriereAnfragen } from "./anfragen.mjs";
import { registriereFundeEinstellung, fundeAktualisieren } from "./funde.mjs";
import { registriereBeute, beuteAnlegen } from "./beute.mjs";
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
  registriereGeheimEinstellungen(GeheimFenster);
  registriereFundeEinstellung();
  registriereAnfragen();
  registriereFenster();
  registriereBeute();

  // Für Makros und zum Nachsehen in der Konsole: game.modules.get("motherboard-data-carrier-journal").api
  game.modules.get(MODUL_ID).api = {
    syntax, sicht, leser, cordexText, cordexHtml,
    oeffneLeserFenster, fuerAlleAbspielen, fuerAlleStoppen, letzterDualityWurf, zeigenDialog,
    geheimStand, fundeAktualisieren, beuteAnlegen
  };
});

Hooks.once("ready", async () => {
  registriereSocket();
  wendeBewegungAn();
  if (game.user.isGM) {
    await ladeSchluessel();
    ansichtenNeuZeichnen();
  }
  zieheAlteDatenUm();
});

// Kommt der GM online (oder geht), holen wartende Spieler ihre Sicht neu.
Hooks.on("userConnected", user => {
  if (user.isGM) ansichtenNeuZeichnen();
});
