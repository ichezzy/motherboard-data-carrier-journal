import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";
import { DatentraegerDaten } from "./datenmodell.mjs";
import { DatentraegerSheet } from "./sheet.mjs";

Hooks.once("init", () => {
  CONFIG.JournalEntryPage.dataModels[SEITEN_TYP] = DatentraegerDaten;

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.JournalEntryPage,
    MODUL_ID,
    DatentraegerSheet,
    { types: [SEITEN_TYP], makeDefault: true, label: "DATENTRAEGER.Sheet" }
  );
});
