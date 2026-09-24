import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { DiagnosticSource, SourceKind } from '../types';

const MAX_ENTRY_CHARACTERS = 80_000_000;
const MAX_TOTAL_CHARACTERS = 180_000_000;
const MAX_ZIP_ENTRIES = 80;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

const TEXT_EXTENSIONS = /\.(txt|log|trace|out|prop|csv|conf)$/i;
const TEXTISH_NAMES = /(bugreport|dumpstate|anr|traces|tombstone|last_kmsg|console-ramoops|pstore|logcat|kernel|dmesg|version\.txt|main-entry\.txt|shutdown-checkpoint|recovery|update_engine)/i;

function classifySource(filename: string): SourceKind {
  const name = filename.toLowerCase();
  if (/version\.txt$|main-entry\.txt$/.test(name)) return 'metadata';
  if (/tombstone/.test(name)) return 'tombstone';
  if (/(^|\/)anr|traces/.test(name)) return 'anr';
  if (/ramoops|last_kmsg|pstore|dmesg|kernel/.test(name)) return 'kernel';
  if (/logcat|event-log|radio-log/.test(name)) return 'logcat';
  if (/bugreport|dumpstate/.test(name)) return 'bugreport';
  return 'other';
}

function scoreEntry(filename: string): number {
  let score = 0;
  const name = filename.toLowerCase();
  if (/main-entry\.txt$/.test(name)) score += 160;
  if (/version\.txt$/.test(name)) score += 150;
  if (/bugreport.*\.txt$/.test(name)) score += 140;
  if (/dumpstate.*\.txt$/.test(name)) score += 120;
  if (/(^|\/)fs\/data\/anr\//.test(name) || /(^|\/)anr[_/]/.test(name)) score += 100;
  if (/tombstone/.test(name)) score += 100;
  if (/ramoops|last_kmsg|pstore/.test(name)) score += 95;
  if (/dmesg|kernel/.test(name)) score += 80;
  if (/shutdown-checkpoint|recovery|update_engine/.test(name)) score += 65;
  if (/logcat/.test(name)) score += 55;
  if (TEXT_EXTENSIONS.test(name)) score += 20;
  if (/\.pb$/i.test(name)) score -= 30;
  if (/\.(png|jpg|jpeg|gif|webp|mp4|apk|bin|so|dex|proto)$/i.test(name)) score -= 200;
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
  if (!TEXT_EXTENSIONS.test(lowerName) && !TEXTISH_NAMES.test(lowerName)) {
    throw new Error('Unsupported file. Use bugreport.zip or Android diagnostic text/log/trace files.');
  }

  const raw = await file.text();
  const limited = truncateText(raw);
  return [{ name: file.name, ...limited, kind: classifySource(file.name) }];
}

async function loadZip(file: File): Promise<DiagnosticSource[]> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    const candidates = entries
      .filter((entry) => !entry.directory)
      .filter((entry) => (entry.uncompressedSize ?? 0) <= MAX_ENTRY_UNCOMPRESSED_BYTES)
      .map((entry) => ({ entry, score: scoreEntry(entry.filename) }))
      .filter(({ entry, score }) => score > 0 || TEXTISH_NAMES.test(entry.filename))
      .sort((a, b) => b.score - a.score || (b.entry.uncompressedSize ?? 0) - (a.entry.uncompressedSize ?? 0))
      .slice(0, MAX_ZIP_ENTRIES);

    if (!candidates.length) {
      throw new Error('No readable Android diagnostic text files were found inside the ZIP.');
    }

    const sources: DiagnosticSource[] = [];
    let totalCharacters = 0;

    for (const { entry } of candidates) {
      if (!entry.getData || totalCharacters >= MAX_TOTAL_CHARACTERS) break;
      let text: string;
      try {
        text = await entry.getData(new TextWriter());
      } catch {
        continue;
      }
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
        kind: classifySource(entry.filename),
      });
      totalCharacters += finalText.length;
    }

    if (!sources.length) throw new Error('The ZIP contained diagnostic files, but none could be read as text.');

    const mainEntry = sources.find((source) => source.name.toLowerCase().endsWith('main-entry.txt'))?.text.trim();
    if (mainEntry) {
      for (const source of sources) {
        if (source.name === mainEntry || source.name.endsWith(`/${mainEntry}`)) source.declaredByMainEntry = true;
      }
    }

    return sources;
  } finally {
    await reader.close();
  }
}
