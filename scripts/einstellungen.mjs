import { MODUL_ID } from "./konstanten.mjs";
import { LeserFenster } from "./leser-fenster.mjs";
import { aktualisiereOffeneJournale } from "./fenster.mjs";

export function registriereEinstellungen() {
  game.settings.register(MODUL_ID, "bewegung", {
    name: "DATENTRAEGER.Einstellung.Bewegung.Name",
    hint: "DATENTRAEGER.Einstellung.Bewegung.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      system: "DATENTRAEGER.Einstellung.Bewegung.system",
      an: "DATENTRAEGER.Einstellung.Bewegung.an",
      aus: "DATENTRAEGER.Einstellung.Bewegung.aus"
    },
    default: "system",
    onChange: wendeBewegungAn
  });

  game.settings.register(MODUL_ID, "fenster", {
    name: "DATENTRAEGER.Einstellung.Fenster.Name",
    hint: "DATENTRAEGER.Einstellung.Fenster.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      art: "DATENTRAEGER.Einstellung.Fenster.art",
      holo: "DATENTRAEGER.Einstellung.Fenster.holo",
      normal: "DATENTRAEGER.Einstellung.Fenster.normal"
    },
    default: "art",
    onChange: () => aktualisiereOffeneJournale()
  });

  game.settings.registerMenu(MODUL_ID, "leser", {
    name: "DATENTRAEGER.Einstellung.Leser.Name",
    label: "DATENTRAEGER.Einstellung.Leser.Label",
    hint: "DATENTRAEGER.Einstellung.Leser.Hint",
    icon: "fa-solid fa-glasses",
    type: LeserFenster,
    restricted: true
  });
}

/**
 * „System“ folgt prefers-reduced-motion (siehe CSS); „an“ und „aus“ überstimmen es.
 */
export function wendeBewegungAn() {
  const wert = game.settings.get(MODUL_ID, "bewegung");
  document.body.classList.toggle("dt-bewegung-an", wert === "an");
  document.body.classList.toggle("dt-bewegung-aus", wert === "aus");
}
