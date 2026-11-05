// Turns a status report (research/status/<date>.md) into a PDF Sandra can open and forward.
//   node scripts/report-pdf.mjs research/status/2026-11-05.md   -> research/status/2026-11-05.pdf
// The report's Markdown is plain (headings, paragraphs, tables), so it is converted here
// rather than adding a Markdown library. Needs Playwright's Chromium.
import fs from 'node:fs';
import { createRequire } from 'node:module';
// Playwright is installed globally on the build machines, not in package.json; require finds it.
const { chromium } = createRequire(import.meta.url)('playwright');

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/report-pdf.mjs <report.md>'); process.exit(1); }
const md = fs.readFileSync(src, 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\(\+?(-?[\d,.]+) better\)/g, '<span class="up">($1 better)</span>')
  .replace(/\(\+?(-?[\d,.]+) worse\)/g, '<span class="down">($1 worse)</span>')
  .replace(/\b(up \d+|new at \d+)\b/g, '<span class="up">$1</span>')
  .replace(/\b(down \d+|lost \(was \d+\))/g, '<span class="down">$1</span>')
  .replace(/\(wrong page\)/g, '<span class="down">(wrong page)</span>');

const out = [];
const lines = md.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('# ')) out.push(`<h1>${inline(l.slice(2))}</h1>`);
  else if (l.startsWith('## ')) out.push(`<h2>${inline(l.slice(3))}</h2>`);
  else if (l.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    i--;
    const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
    const [head, , ...body] = rows;
    out.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
  } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
}

const html = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><style>
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Inter, Arial, sans-serif; color: #16191d; margin: 0; }
  h1 { font-size: 20pt; color: #0d5c8c; margin: 0 0 4pt; }
  h2 { font-size: 13.5pt; color: #0a4870; margin: 22pt 0 6pt; padding-top: 8pt; border-top: 1px solid #e3e6e9; }
  p { margin: 4pt 0; color: #4a525b; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 4pt; font-size: 9.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: #eaf3f8; color: #0a4870; padding: 5pt 6pt; }
  td { padding: 4pt 6pt; border-bottom: 1px solid #eef0f2; vertical-align: top; }
  h2 + p + table td:first-child, table td:first-child { font-weight: 600; color: #16191d; }
  .up { color: #1b7a3d; font-weight: 600; } .down { color: #b3261e; font-weight: 600; }
</style></head><body>${out.join('\n')}</body></html>`;

const pdf = src.replace(/\.md$/, '.pdf');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: pdf, format: 'A4', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' }, printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8pt;color:#888;width:100%;text-align:center">Heat Pumps HQ status report · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
await browser.close();
console.log(pdf);
