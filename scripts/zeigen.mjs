/**
 * Lesestufe (Phase 2): Beim Zeigen wählt der GM das Ergebnis des Wurfs.
 * Stellen mit einer Lesestufe werden ab diesem Ergebnis für alle lesbar.
 * Das Ergebnis steht als Flag an der Seite, damit jeder Client es kennt.
 */
import { STUFEN } from "./konstanten.mjs";
import { stufeAusWurf } from "./wurf.mjs";
import { escapeHtml } from "./syntax.mjs";
import { stufeVon, setzeStufe } from "./seite.mjs";
import { fundeAktualisieren } from "./funde.mjs";

export { stufeVon, setzeStufe };

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * Der letzte Duality-Wurf im Chat (Daggerheart von Foundryborne).
 * @returns {{stufe: string, sicher: boolean, wer: string, total: number}|null}
 */
export function letzterDualityWurf(maxNachrichten = 50) {
  const DualityRoll = game.system?.api?.dice?.DualityRoll;
  const nachrichten = game.messages.contents;
  for (let i = nachrichten.length - 1, n = 0; i >= 0 && n < maxNachrichten; i--, n++) {
    const nachricht = nachrichten[i];
    const wurf = (nachricht.rolls ?? []).find(r =>
      DualityRoll ? r instanceof DualityRoll : ("withHope" in r && "isCritical" in r));
    if (!wurf?._evaluated) continue;
    const optionen = wurf.options?.roll ?? {};
    let erfolg = optionen.success;
    if (typeof erfolg !== "boolean" && Number.isFinite(optionen.difficulty)) {
      erfolg = wurf.isCritical || wurf.total >= optionen.difficulty;
    }
    return {
      ...stufeAusWurf({ kritisch: wurf.isCritical, erfolg, hope: wurf.withHope }),
      wer: nachricht.speaker?.alias ?? nachricht.author?.name ?? "?",
      total: wurf.total
    };
  }
  return null;
}

/** Auswahl der fünf Ergebnisse, bestes zuerst. */
export function stufenOptionen(gewaehlt) {
  return [
    { wert: "", label: L("DATENTRAEGER.Stufe.Keins"), gewaehlt: !gewaehlt },
    ...STUFEN.slice().reverse().map(s => ({ wert: s, label: s, gewaehlt: s === gewaehlt }))
  ];
}

/**
 * Dialog „Seite zeigen“: Ergebnis wählen (vorgeschlagen aus dem letzten Duality-Wurf),
 * dann die Seite allen zeigen.
 */
export async function zeigenDialog(page) {
  const vorschlag = letzterDualityWurf();
  const gewaehlt = vorschlag?.stufe ?? stufeVon(page);
  const optionen = stufenOptionen(gewaehlt)
    .map(o => `<option value="${escapeHtml(o.wert)}" ${o.gewaehlt ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
    .join("");
  const hinweis = vorschlag
    ? F("DATENTRAEGER.Stufe.Vorschlag", { wer: escapeHtml(vorschlag.wer), stufe: vorschlag.stufe, total: vorschlag.total })
      + (vorschlag.sicher ? "" : ` ${L("DATENTRAEGER.Stufe.OhneDifficulty")}`)
    : L("DATENTRAEGER.Stufe.KeinWurf");

  const content = `
    <div class="dt-dialog">
      <p>${L("DATENTRAEGER.Stufe.ZeigenHinweis")}</p>
      <p class="hint">${hinweis}</p>
      <div class="form-group">
        <label>${L("DATENTRAEGER.Stufe.Label")}</label>
        <div class="form-fields"><select name="stufe">${optionen}</select></div>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.Stufe.Total")}</label>
        <div class="form-fields"><input type="number" name="total" min="1" max="60" step="1" value="${vorschlag?.total ?? ""}"></div>
        <p class="hint">${L("DATENTRAEGER.Stufe.TotalHinweis")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox"><input type="checkbox" name="anAlle" checked> ${L("DATENTRAEGER.Stufe.AnAlle")}</label>
      </div>
    </div>`;

  const ergebnis = await foundry.applications.api.DialogV2.wait({
    window: { title: L("DATENTRAEGER.Stufe.ZeigenTitel"), icon: "fa-solid fa-eye" },
    position: { width: 440 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok",
        label: L("DATENTRAEGER.Stufe.Zeigen"),
        icon: "fa-solid fa-eye",
        default: true,
        callback: (event, button) => ({
          stufe: button.form.elements.stufe.value,
          total: button.form.elements.total.value ? Math.round(Number(button.form.elements.total.value)) : null,
          anAlle: button.form.elements.anAlle.checked
        })
      },
      { action: "abbrechen", label: L("DATENTRAEGER.Markieren.Abbrechen"), icon: "fa-solid fa-xmark" }
    ]
  });
  if (!ergebnis || typeof ergebnis !== "object") return;

  await setzeStufe(page, ergebnis.stufe, ergebnis.total);
  if (ergebnis.anAlle) {
    const Journal = foundry.documents.collections?.Journal ?? globalThis.Journal;
    await Journal.show(page, { force: true });
    // Was alle gesehen haben, kommt ins Journal „Funde“.
    await fundeAktualisieren(page);
  }
}
