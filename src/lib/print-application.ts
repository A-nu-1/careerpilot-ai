/** Print a polished A4 document using the browser (no PDF dependency or paid service). */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );
}

function renderCv(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let listOpen = false;
  let nameUsed = false;
  const closeList = () => {
    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    closeList();
    const heading = line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "");
    const mdHeading = /^#{1,4}\s/.test(line);
    const section =
      mdHeading ||
      /^(?:PROFESSIONAL (?:SUMMARY|EXPERIENCE|PROFILE)|WORK EXPERIENCE|EXPERIENCE|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|CERTIFICATIONS|LANGUAGES|CONTACT|PROFILE|BERUFSERFAHRUNG|BERUFLICHER WERDEGANG|BERUFSPROFIL|PROFIL|AUSBILDUNG|KENNTNISSE|FACHKENNTNISSE|TECHNISCHE KENNTNISSE|PROJEKTE|SPRACHEN|ZERTIFIKATE|WEITERBILDUNG|BERUFLICHE ERFAHRUNG|PERSÖNLICHE ANGABEN|KONTAKT)(?:\s*:)?$/i.test(
        heading,
      ) ||
      (heading.length < 50 &&
        heading === heading.toUpperCase() &&
        /[A-ZÄÖÜ]/.test(heading) &&
        !heading.includes("@"));
    if (section) {
      output.push(`<h2>${escapeHtml(heading)}</h2>`);
      continue;
    }
    if (!nameUsed) {
      output.push(`<h1>${escapeHtml(heading)}</h1>`);
      nameUsed = true;
      continue;
    }
    if (/^(?:\*\*.+\*\*|.+\s\|\s.+)$/.test(line)) {
      output.push(`<h3>${escapeHtml(heading)}</h3>`);
      continue;
    }
    output.push(`<p>${escapeHtml(heading)}</p>`);
  }
  closeList();
  return output.join("\n");
}

function renderLetter(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .filter((x) => x.trim())
    .map((part) => `<p>${escapeHtml(part.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function printApplicationPdf(
  title: string,
  text: string,
  kind: "cv" | "letter" = "letter",
  language: "English" | "German" = "English",
) {
  const win = window.open("", "_blank", "width=900,height=950");
  if (!win)
    throw new Error(
      "Allow pop-ups to export a PDF. Then use Print → Save as PDF.",
    );
  const html = kind === "cv" ? renderCv(text) : renderLetter(text);
  const safeTitle = escapeHtml(title);
  const documentLanguage = language === "German" ? "de-CH" : "en";
  win.document.open();
  win.document
    .write(`<!doctype html><html lang="${documentLanguage}"><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>
@page { size: A4; margin: 17mm 19mm 17mm 19mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.2pt; line-height: 1.43; color: #202631; max-width: 172mm; margin: 24px auto; }
h1 { font-size: 21pt; letter-spacing: -.6px; line-height: 1.15; color: #25223c; margin: 0 0 11pt; font-weight: 700; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1px; color: #5b3e82; border-bottom: 1px solid #ded6e9; padding-bottom: 4pt; margin: 16pt 0 7pt; break-after: avoid; }
h3 { font-size: 10.3pt; margin: 11pt 0 4pt; color: #25223c; break-after: avoid; }
p { margin: 0 0 7pt; overflow-wrap: anywhere; }
ul { padding-left: 17pt; margin: 2pt 0 9pt; }
li { margin: 0 0 4pt; padding-left: 2pt; break-inside: avoid; }
section, p { orphans: 2; widows: 2; }
.letter-heading { font-size: 14pt; font-weight: 700; margin: 0 0 19pt; color: #25223c; }
@media print { body { max-width: none; margin: 0; } }
</style></head><body>${kind === "letter" ? `<div class="letter-heading">${safeTitle}</div>` : ""}${html}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* User may print manually. */
    }
  }, 450);
}
