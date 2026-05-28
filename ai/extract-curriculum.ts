import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = resolve(__dirname, 'curriculum-orientierungskurs.pdf');
const OUT_PATH = resolve(__dirname, 'curriculum.md');

function cleanup(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      if (line === '') return false;
      // bare page numbers
      if (/^\d+$/.test(line)) return false;
      if (/^Seite\s+\d+(\s*\/\s*\d+)?$/i.test(line)) return false;
      if (/^\d+\s*\/\s*\d+$/.test(line)) return false;
      // repeating page headers/footers
      if (/^Orientierungskurs\s*\|/.test(line)) return false;
      if (/^\d+\s*Orientierungskurs/.test(line)) return false;
      // ToC dot-leader lines, e.g. "Modul I ............................... 24"
      if (/\.{6,}\s*\d+$/.test(line)) return false;
      return true;
    });

  // Drop everything before the real content (the Module section under
  // "Lernziele und Inhalte") and after the Impressum marker.
  const startIdx = lines.findIndex((l) => /^Modul I: Politik in der Demokratie/.test(l));
  const endIdx = lines.findIndex((l) => l === 'Impressum');
  const sliced = lines.slice(startIdx >= 0 ? startIdx : 0, endIdx >= 0 ? endIdx : lines.length);

  return sliced.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function main() {
  const buf = await readFile(PDF_PATH);
  const parsed = await pdfParse(buf);
  const cleaned = cleanup(parsed.text);
  await writeFile(OUT_PATH, cleaned + '\n', 'utf8');
  console.log(`extracted ${parsed.numpages} pages → ${OUT_PATH} (${cleaned.length.toLocaleString()} chars)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
