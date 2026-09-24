import type {
  Evidence,
  EvidenceStrength,
  FindingCategory,
  IndexedLine,
  Severity,
} from './types';

const ANDROID_TS = /\b(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3,6})\b/;
const ISO_TS = /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/;
const KERNEL_TS = /^\[\s*(\d+(?:\.\d+)?)\]/;

export function extractTimestamp(line: string): string | undefined {
  return line.match(ISO_TS)?.[1] ?? line.match(ANDROID_TS)?.[1] ?? line.match(KERNEL_TS)?.[1];
}

export function indexSources(sources: { name: string; text: string; kind?: IndexedLine['sourceKind'] }[]): IndexedLine[] {
  const indexed: IndexedLine[] = [];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      indexed.push({
        source: source.name,
        sourceKind: source.kind,
        lineNumber: i + 1,
        text,
        timestamp: extractTimestamp(text),
      });
    }
  }
  return indexed;
}

export function toEvidence(line: IndexedLine, maxLength = 420): Evidence {
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

export function countMatchingLines(lines: IndexedLine[], include: RegExp[], exclude: RegExp[] = []): number {
  let count = 0;
  for (const line of lines) {
    if (!include.some((pattern) => pattern.test(line.text))) continue;
    if (exclude.some((pattern) => pattern.test(line.text))) continue;
    count += 1;
  }
  return count;
}

export function contextAround(lines: IndexedLine[], anchor: IndexedLine, before = 3, after = 5): IndexedLine[] {
  const sameSource = lines.filter((line) => line.source === anchor.source);
  const index = sameSource.findIndex((line) => line.lineNumber === anchor.lineNumber);
  if (index < 0) return [anchor];
  return sameSource.slice(Math.max(0, index - before), index + after + 1);
}

export function uniqueEvidence(lines: IndexedLine[], limit = 12): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const line of lines) {
    const key = `${line.source}:${line.lineNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(toEvidence(line));
    if (result.length >= limit) break;
  }
  return result;
}

export function confidenceFromEvidence(count: number, base: number, step = 8): number {
  return Math.min(99, Math.max(1, base + Math.max(0, count - 1) * step));
}

export function strengthFromConfidence(confidence: number): EvidenceStrength {
  if (confidence >= 85) return 'strong';
  if (confidence >= 65) return 'moderate';
  return 'weak';
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

export function firstCapture(lines: IndexedLine[], expression: RegExp, group = 1): string | undefined {
  for (const line of lines) {
    const match = line.text.match(expression);
    const value = match?.[group]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function withEvidenceStrength<T extends { confidence: number }>(finding: T): T & { evidenceStrength: EvidenceStrength } {
  return { ...finding, evidenceStrength: strengthFromConfidence(finding.confidence) };
}
