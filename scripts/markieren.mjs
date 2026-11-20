import { LUECKEN, ALLE_LUECKEN, MIT_ERSATZ, OHNE_TEXT, STANDARD_ANCESTRY, STANDARD_ERSATZ, STUFEN, lueckenWort } from "./konstanten.mjs";
import { escapeHtml, markierungsRahmen } from "./syntax.mjs";
import { spielerCharaktere } from "./leser.mjs";

const L = key => game.i18n.localize(key);

/**
 * Dialog: Art der Lücke und wer sie lesen kann.
 * @param {{seitenArt: string, auswahl: string}} optionen
 * @returns {Promise<{art: string, ersatz: string, ancestries: string[], charaktere: string[]}|null>}
 */
export async function markierDialog({ seitenArt, auswahl }) {
  const arten = LUECKEN[seitenArt] ?? ALLE_LUECKEN;
  const charaktere = spielerCharaktere();
  const auswahlKurz = auswahl.length > 80 ? `${auswahl.slice(0, 79)}…` : auswahl;

  const content = `
    <div class="dt-dialog">
      ${auswahl ? `<p class="hint">${L("DATENTRAEGER.Markieren.Auswahl")}: “${escapeHtml(auswahlKurz)}”</p>` : ""}
      <div class="form-group">
        <label>${L("DATENTRAEGER.Markieren.ArtDerLuecke")}</label>
        <div class="form-fields">
          <select name="art">${arten.map(a => `<option value="${a}">${lueckenWort(a)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-group">
        <label>${L("DATENTRAEGER.Markieren.Ersatz")}</label>
        <div class="form-fields">
          <input type="text" name="ersatz" placeholder="${escapeHtml(STANDARD_ERSATZ.gesperrt)}">
        </div>
        <p class="hint">${L("DATENTRAEGER.Markieren.ErsatzHinweis")}</p>
      </div>
      <fieldset>
        <legend>${L("DATENTRAEGER.Markieren.WerLiest")}</legend>
        <div class="form-group">
          <label class="checkbox"><input type="checkbox" name="mitAncestry"> ${L("DATENTRAEGER.Markieren.Ancestry")}</label>
          <div class="form-fields"><input type="text" name="ancestry" value="${escapeHtml(STANDARD_ANCESTRY)}"></div>
          <p class="hint">${L("DATENTRAEGER.Markieren.AncestryHinweis")}</p>
        </div>
        <div class="form-group stacked">
          <label>${L("DATENTRAEGER.Markieren.Charaktere")}</label>
          <div class="dt-dialog-charaktere">
            ${charaktere.length
              ? charaktere.map(a => `<label class="checkbox"><input type="checkbox" name="charaktere" value="${escapeHtml(a.name)}"> ${escapeHtml(a.name)}</label>`).join("")
              : `<span class="hint">${L("DATENTRAEGER.Markieren.KeineCharaktere")}</span>`}
          </div>
        </div>
        <div class="form-group">
          <label>${L("DATENTRAEGER.Markieren.Stufe")}</label>
          <div class="form-fields">
            <select name="stufe">
              <option value="">${L("DATENTRAEGER.Markieren.StufeKeine")}</option>
              ${STUFEN.slice().reverse().map(s => `<option value="${s}">${s}</option>`).join("")}
            </select>
          </div>
          <p class="hint">${L("DATENTRAEGER.Markieren.StufeHinweis")}</p>
        </div>
        <p class="hint">${L("DATENTRAEGER.Markieren.ZerfallenHinweis")}</p>
      </fieldset>
    </div>`;

  const ergebnis = await foundry.applications.api.DialogV2.wait({
    window: { title: L("DATENTRAEGER.Markieren.Titel"), icon: "fa-solid fa-highlighter" },
    position: { width: 460 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok",
        label: L("DATENTRAEGER.Markieren.Ok"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => {
          const form = button.form;
          const ancestry = form.elements.mitAncestry.checked ? form.elements.ancestry.value : "";
          return {
            art: form.elements.art.value,
            ersatz: form.elements.ersatz.value,
            ancestries: ancestry.split(",").map(s => s.trim()).filter(Boolean),
            charaktere: Array.from(form.querySelectorAll("input[name='charaktere']:checked"), i => i.value),
            stufen: form.elements.stufe.value ? [form.elements.stufe.value] : []
          };
        }
      },
      { action: "abbrechen", label: L("DATENTRAEGER.Markieren.Abbrechen"), icon: "fa-solid fa-xmark" }
    ]
  });
  return ergebnis && typeof ergebnis === "object" ? ergebnis : null;
}

/**
 * Die Auswahl im ProseMirror-Editor mit einer Markierung umschließen.
 * Schreibt nur Text – die Markierung bleibt im Rohtext lesbar.
 * @param {import("prosemirror-view").EditorView} view
 * @param {string} seitenArt
 */
export async function markiereAuswahl(view, seitenArt) {
  if (!pruefeAuswahl(view.state.selection)) return;
  const { from, to } = view.state.selection;
  const auswahl = view.state.doc.textBetween(from, to, " ");
  const daten = await markierDialog({ seitenArt, auswahl });
  if (!daten || view.isDestroyed) return;

  // Während der Dialog offen war, kann sich die Auswahl geändert haben – den aktuellen Stand nehmen.
  const sel = view.state.selection;
  if (!pruefeAuswahl(sel)) return;
  if (sel.empty && !OHNE_TEXT.has(daten.art)) {
    ui.notifications.warn("DATENTRAEGER.Markieren.NichtLeer", { localize: true });
    return;
  }
  const rahmen = markierungsRahmen({ ...daten, ersatz: MIT_ERSATZ.has(daten.art) ? daten.ersatz : "" });

  // Erst hinten, dann vorne einfügen, damit die Positionen stimmen.
  let tr = view.state.tr;
  if (sel.empty) tr = tr.insertText(rahmen.ohneText, sel.from);
  else tr = tr.insertText(rahmen.nach, sel.to).insertText(rahmen.vor, sel.from);
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** Eine Markierung muss in einem Absatz bleiben. */
function pruefeAuswahl(sel) {
  if (sel.empty || sel.$from.sameParent(sel.$to)) return true;
  ui.notifications.warn("DATENTRAEGER.Markieren.EinAbsatz", { localize: true });
  return false;
}
