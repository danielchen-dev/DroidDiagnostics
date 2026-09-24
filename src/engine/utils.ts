import type { Evidence, FindingCategory, IndexedLine, Severity } from './types';

const ANDROID_TS = /\b(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3,6})\b/;
const ISO_TS = /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/;

export function extractTimestamp(line: string): string | undefined {
  return line.match(ISO_TS)?.[1] ?? line.match(ANDROID_TS)?.[1];
}

export function indexSources(sources: { name: string; text: string }[]): IndexedLine[] {
  const indexed: IndexedLine[] = [];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      indexed.push({
        source: source.name,
        lineNumber: i + 1,
        text,
        timestamp: extractTimestamp(text),
      });
    }
  }
  return indexed;
}

export function toEvidence(line: IndexedLine, maxLength = 360): Evidence {
  const normalized = line.text.replace(/\s+/g, ' ').trim();
  return {
    source: line.source,
    lineNumber: line.lineNumber,
    timestamp: line.timestamp,
    excerpt: normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized,
  };
}

export function findMatchingLines(
  lines: IndexedLine[],
  include: RegExp[],
  exclude: RegExp[] = [],
  limit = 8,
): IndexedLine[] {
  const matches: IndexedLine[] = [];
  for (const line of lines) {
    if (!include.some((pattern) => pattern.test(line.text))) continue;
    if (exclude.some((pattern) => pattern.test(line.text))) continue;
    matches.push(line);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function confidenceFromEvidence(count: number, base: number, step = 8): number {
  return Math.min(99, Math.max(1, base + Math.max(0, count - 1) * step));
}

export function severityRank(severity: Severity): number {
  const ranks: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  return ranks[severity];
}

export function stableFindingId(category: FindingCategory, key: string): string {
  let hash = 2166136261;
  const input = `${category}:${key}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${category}-${(hash >>> 0).toString(16)}`;
}
