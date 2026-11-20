/**
 * Zugangskarten (Schritt 2, 0.5.2): Level 1–3, optional mit Aussteller (z. B. CTC).
 * Wer eine Karte im Inventar trägt, liest Stellen mit „Level n“ bzw. „CTC Level n“ sofort.
 *
 * Fälschungsschutz: Jede Karte hat eine Kennung; Level und Aussteller stehen in einer
 * Welt-Einstellung, die nur der GM schreiben kann. Eine selbst gebaute Karte eines Spielers
 * (gleiches Flag, ausgedachte Kennung) zählt nicht.
 */
import { MODUL_ID } from "./konstanten.mjs";
import { escapeHtml } from "./syntax.mjs";
import { lootTyp } from "./beute.mjs";
import { ordnerId } from "./ordner.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

export const KARTEN_LEVEL = [1, 2, 3];

export function kartenSymbol(level) {
  return `modules/${MODUL_ID}/assets/icons/keycard-${KARTEN_LEVEL.includes(level) ? level : 1}.webp`;
}

export function registriereKarten() {
  game.settings.register(MODUL_ID, "zugangskarten", { scope: "world", config: false, type: Object, default: {} });

  // Knopf „Access Card“ oben in der Items-Seitenleiste (nur GM).
  Hooks.on("renderItemDirectory", (app, element) => {
    if (!game.user.isGM) return;
    const html = element instanceof HTMLElement ? element : element?.[0];
    const leiste = html?.querySelector(".header-actions");
    if (!leiste || leiste.querySelector(".dt-karte-anlegen")) return;
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "dt-karte-anlegen";
    knopf.dataset.tooltip = L("DATENTRAEGER.Karten.Tip");
    knopf.innerHTML = `<i class="fa-solid fa-id-card" inert></i> <span>${escapeHtml(L("DATENTRAEGER.Karten.Knopf"))}</span>`;
    knopf.addEventListener("click", event => {
      event.preventDefault();
      kartenDialog();
    });
    leiste.append(knopf);
  });
}

/** Alle ausgestellten Karten: { kennung: { level, aussteller } } */
function register() {
  return game.settings.get(MODUL_ID, "zugangskarten") ?? {};
}

/**
 * Gültige Zugangskarten im Inventar eines Charakters. Es zählt, was der GM beim Ausstellen
 * eingetragen hat – nicht, was im Item steht.
 * @returns {{level: number, aussteller: string|null}[]}
 */
export function zugangskartenVon(actor) {
  const alle = register();
  const karten = [];
  for (const item of actor?.items ?? []) {
    const eintrag = alle[item.getFlag?.(MODUL_ID, "zugang")?.karte];
    if (eintrag && KARTEN_LEVEL.includes(eintrag.level)) karten.push({ level: eintrag.level, aussteller: eintrag.aussteller ?? null });
  }
  return karten;
}

/** Karte ausstellen (nur GM): Eintrag im Register, Loot-Item im eingestellten Ordner. */
export async function zugangskarteAnlegen({ level, aussteller = "", name = "" } = {}) {
  if (!game.user.isGM || !KARTEN_LEVEL.includes(level)) return null;
  const von = String(aussteller ?? "").trim() || null;
  const karte = foundry.utils.randomID();
  await game.settings.set(MODUL_ID, "zugangskarten", { ...foundry.utils.deepClone(register()), [karte]: { level, aussteller: von } });

  const titel = String(name ?? "").trim()
    || F(von ? "DATENTRAEGER.Karten.NameMit" : "DATENTRAEGER.Karten.Name", { level, aussteller: von });
  const text = F(von ? "DATENTRAEGER.Karten.BeschreibungMit" : "DATENTRAEGER.Karten.Beschreibung", { level, aussteller: von });
  const item = await CONFIG.Item.documentClass.create({
    name: titel,
    type: lootTyp(),
    img: kartenSymbol(level),
    folder: ordnerId("Item"),
    system: { description: `<p>${escapeHtml(text)}</p>` },
    flags: { [MODUL_ID]: { zugang: { karte, level, aussteller: von } } }
  });
  item?.sheet?.render({ force: true });
  return item;
}

/** Dialog „Access Card“: Level, Aussteller, Name. */
export async function kartenDialog() {
  if (!game.user.isGM) return;
  const content = `
    <div class="dt-dialog">
      <div class="form-group">
        <label>${L("DATENTRAEGER.Karten.Level")}</label>
        <div class="form-fields">
          <select name="level">${KARTEN_LEVEL.map(l => `<option value="${l}">Level ${l}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.Karten.Aussteller")}</label>
        <div class="form-fields"><input type="text" name="aussteller" placeholder="CTC"></div>
        <p class="hint">${L("DATENTRAEGER.Karten.AusstellerHinweis")}</p>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.Karten.NameFeld")}</label>
        <div class="form-fields"><input type="text" name="name" placeholder="${escapeHtml(L("DATENTRAEGER.Karten.NameLeer"))}"></div>
      </div>
    </div>`;
  const eingabe = await foundry.applications.api.DialogV2.wait({
    window: { title: L("DATENTRAEGER.Karten.Titel"), icon: "fa-solid fa-id-card" },
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok",
        label: L("DATENTRAEGER.Karten.Ok"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          return { level: Number(f.level.value), aussteller: f.aussteller.value, name: f.name.value };
        }
      },
      { action: "abbrechen", label: L("DATENTRAEGER.Markieren.Abbrechen"), icon: "fa-solid fa-xmark" }
    ]
  });
  if (!eingabe || typeof eingabe !== "object") return;
  return zugangskarteAnlegen(eingabe);
}
