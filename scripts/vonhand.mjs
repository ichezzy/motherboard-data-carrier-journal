/**
 * Ergebnis von Hand eintragen (0.5.1): für Würfel am Tisch. Der GM wählt den Charakter, trägt
 * Gesamtwert und Hope/Fear ein – das Modul behandelt es wie einen Entschlüsseln-Wurf in Foundry,
 * mit denselben Folgen (zerstört, Zerfall, Preis) und demselben „Für alle freigeben“.
 */
import { spielerCharaktere } from "./leser.mjs";
import { versuchEintragen } from "./anfragen.mjs";
import { versuchVon, zustandVon, wurfVon } from "./seite.mjs";
import { escapeHtml } from "./syntax.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Zu welchem Spieler gehört dieser Charakter? (für „nur er sieht es, bis er freigibt“) */
function spielerVon(actor) {
  return game.users.find(u => !u.isGM && u.character?.id === actor.id) ?? null;
}

export async function vonHandDialog(page) {
  if (!game.user.isGM) return;
  if (versuchVon(page)) return ui.notifications.warn("DATENTRAEGER.VonHand.SchonVersucht", { localize: true });
  if (zustandVon(page).zerstoert) return ui.notifications.warn("DATENTRAEGER.Entschluesseln.Zerstoert", { localize: true });
  const charaktere = spielerCharaktere();
  if (!charaktere.length) return ui.notifications.warn("DATENTRAEGER.Markieren.KeineCharaktere", { localize: true });

  const { trait, difficulty } = wurfVon(page);
  const optionen = charaktere.map(a => {
    const spieler = spielerVon(a);
    return `<option value="${a.id}">${escapeHtml(a.name)}${spieler ? ` (${escapeHtml(spieler.name)})` : ""}</option>`;
  }).join("");

  const content = `
    <div class="dt-dialog">
      <p class="hint">${L("DATENTRAEGER.VonHand.Hinweis")}</p>
      <p>${escapeHtml(F("DATENTRAEGER.VonHand.Wurf", { trait: L(`DATENTRAEGER.Trait.${trait}`), difficulty }))}</p>
      <div class="form-group">
        <label>${L("DATENTRAEGER.VonHand.Charakter")}</label>
        <div class="form-fields"><select name="actor">${optionen}</select></div>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.VonHand.Total")}</label>
        <div class="form-fields"><input type="number" name="total" min="1" max="60" step="1" required autofocus></div>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.VonHand.Ausgang")}</label>
        <div class="form-fields">
          <select name="ausgang">
            <option value="hope">${L("DATENTRAEGER.VonHand.MitHope")}</option>
            <option value="fear">${L("DATENTRAEGER.VonHand.MitFear")}</option>
            <option value="kritisch">${L("DATENTRAEGER.VonHand.Kritisch")}</option>
          </select>
        </div>
        <p class="hint">${L("DATENTRAEGER.VonHand.AusgangHinweis")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox"><input type="checkbox" name="geteilt"> ${L("DATENTRAEGER.VonHand.Teilen")}</label>
      </div>
    </div>`;

  const eingabe = await foundry.applications.api.DialogV2.wait({
    window: { title: L("DATENTRAEGER.VonHand.Titel"), icon: "fa-solid fa-hand" },
    position: { width: 440 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok",
        label: L("DATENTRAEGER.VonHand.Ok"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          return {
            actorId: f.actor.value,
            total: Math.round(Number(f.total.value)),
            ausgang: f.ausgang.value,
            geteilt: f.geteilt.checked
          };
        }
      },
      { action: "abbrechen", label: L("DATENTRAEGER.Markieren.Abbrechen"), icon: "fa-solid fa-xmark" }
    ]
  });
  if (!eingabe || typeof eingabe !== "object") return;
  if (!Number.isFinite(eingabe.total) || eingabe.total < 1) {
    return ui.notifications.warn("DATENTRAEGER.VonHand.KeinTotal", { localize: true });
  }
  const actor = game.actors.get(eingabe.actorId);
  if (!actor) return;

  try {
    // Die Meldung (bzw. der Preis-Dialog) kommt aus versuchEintragen – wie beim Wurf in Foundry.
    await versuchEintragen(page, {
      userId: spielerVon(actor)?.id ?? null,
      actor,
      total: eingabe.total,
      kritisch: eingabe.ausgang === "kritisch",
      hope: eingabe.ausgang !== "fear",
      vonHand: true,
      geteilt: eingabe.geteilt
    });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}
