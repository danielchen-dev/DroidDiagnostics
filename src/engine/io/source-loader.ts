import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { DiagnosticSource } from '../types';

const MAX_ENTRY_CHARACTERS = 80_000_000;
const MAX_TOTAL_CHARACTERS = 140_000_000;
const MAX_ZIP_ENTRIES = 30;

const TEXT_EXTENSIONS = /\.(txt|log|trace|out|prop)$/i;
const HIGH_VALUE_NAMES = /(bugreport|dumpstate|anr|traces|tombstone|last_kmsg|console-ramoops|pstore|logcat|kernel|dmesg)/i;

function scoreEntry(filename: string): number {
  let score = 0;
  const name = filename.toLowerCase();
  if (/bugreport.*\.txt$/.test(name)) score += 100;
  if (/dumpstate.*\.txt$/.test(name)) score += 80;
  if (/anr|traces/.test(name)) score += 50;
  if (/tombstone|ramoops|last_kmsg|dmesg|kernel/.test(name)) score += 45;
  if (/logcat/.test(name)) score += 35;
  if (TEXT_EXTENSIONS.test(name)) score += 10;
  if (/\.(png|jpg|jpeg|gif|mp4|apk|bin|so|dex)$/i.test(name)) score -= 100;
  return score;
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_ENTRY_CHARACTERS) return { text, truncated: false };
  return {
    text: `${text.slice(0, MAX_ENTRY_CHARACTERS)}\n\n[TRUNCATED BY DROIDDIAGNOSTICS]`,
    truncated: true,
  };
}

export async function loadDiagnosticFile(file: File): Promise<DiagnosticSource[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.zip')) return loadZip(file);
  if (!TEXT_EXTENSIONS.test(lowerName)) {
    throw new Error('Unsupported file. Use bugreport.zip, .txt, .log, .trace, .out, or .prop files.');
  }

  const raw = await file.text();
  const limited = truncateText(raw);
  return [{ name: file.name, ...limited }];
}

async function loadZip(file: File): Promise<DiagnosticSource[]> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    const candidates = entries
      .filter((entry) => !entry.directory)
      .map((entry) => ({ entry, score: scoreEntry(entry.filename) }))
      .filter(({ entry, score }) => score > 0 || HIGH_VALUE_NAMES.test(entry.filename))
      .sort((a, b) => b.score - a.score || (b.entry.uncompressedSize ?? 0) - (a.entry.uncompressedSize ?? 0))
      .slice(0, MAX_ZIP_ENTRIES);

    if (!candidates.length) {
      throw new Error('No readable Android diagnostic text files were found inside the ZIP.');
    }

    const sources: DiagnosticSource[] = [];
    let totalCharacters = 0;

    for (const { entry } of candidates) {
      if (!entry.getData) continue;
      if (totalCharacters >= MAX_TOTAL_CHARACTERS) break;

      const text = await entry.getData(new TextWriter());
      const limited = truncateText(text);
      const remaining = MAX_TOTAL_CHARACTERS - totalCharacters;
      const finalText = limited.text.length > remaining
        ? `${limited.text.slice(0, Math.max(0, remaining))}\n\n[TRUNCATED BY DROIDDIAGNOSTICS]`
        : limited.text;

      if (!finalText.trim()) continue;
      sources.push({
        name: entry.filename,
        text: finalText,
        truncated: limited.truncated || finalText.length < limited.text.length,
      });
      totalCharacters += finalText.length;
    }

    if (!sources.length) throw new Error('The ZIP contained diagnostic files, but none could be read as text.');
    return sources;
  } finally {
    await reader.close();
  }
}
