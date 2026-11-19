import { MODUL_ID } from "./konstanten.mjs";
import { LeserFenster } from "./leser-fenster.mjs";

export function registriereEinstellungen() {
  game.settings.registerMenu(MODUL_ID, "leser", {
    name: "DATENTRAEGER.Einstellung.Leser.Name",
    label: "DATENTRAEGER.Einstellung.Leser.Label",
    hint: "DATENTRAEGER.Einstellung.Leser.Hint",
    icon: "fa-solid fa-glasses",
    type: LeserFenster,
    restricted: true
  });
}
