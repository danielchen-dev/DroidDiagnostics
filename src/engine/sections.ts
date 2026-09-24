import type { DiagnosticSource, ReportInventory, ReportSection, SourceKind } from './types';

const COMMAND_HEADER = /^------\s+(.+?)(?:\s+\([^)]*\))?\s+------\s*$/;
const GROUP_HEADER = /^==\s+(.+?)\s*$/;

function sectionKind(title: string): ReportSection['kind'] {
  const value = title.toLowerCase();
  if (/system log|event log|radio log|logcat/.test(value)) return 'logcat';
  if (/last kmsg|kernel log|dmesg|kmsg|pstore|ramoops/.test(value)) return 'kernel';
  if (/battery|batterystats|deviceidle|power/.test(value)) return 'battery';
  if (/meminfo|memory|vmstat|psi |slab|zoneinfo|buddyinfo|process times/.test(value)) return 'memory';
  if (/network|netstat|netd|wifi|connectivity|route|arp|socket|ip /.test(value)) return 'network';
  if (/process|threads|lsof|wchan|cpu info|top /.test(value)) return 'process';
  if (/filesystem|mount|block|storage|storaged|iostat|f2fs|ext4/.test(value)) return 'filesystem';
  if (/anr|vm traces/.test(value)) return 'anr';
  if (/dumpsys|service /.test(value)) return 'dumpsys';
  return 'other';
}

function sourceKindFromName(name: string): SourceKind {
  const value = name.toLowerCase();
  if (/main-entry\.txt$|version\.txt$/.test(value)) return 'metadata';
  if (/tombstone/.test(value)) return 'tombstone';
  if (/(^|\/)anr|traces/.test(value)) return 'anr';
  if (/ramoops|last_kmsg|pstore|dmesg|kernel/.test(value)) return 'kernel';
  if (/logcat|event-log|radio-log/.test(value)) return 'logcat';
  if (/bugreport|dumpstate/.test(value)) return 'bugreport';
  return 'other';
}

export function normalizeSourceKinds(sources: DiagnosticSource[]): DiagnosticSource[] {
  return sources.map((source) => ({ ...source, kind: source.kind ?? sourceKindFromName(source.name) }));
}

export function buildReportInventory(sources: DiagnosticSource[]): ReportInventory {
  const normalized = normalizeSourceKinds(sources);
  const sourceKinds: ReportInventory['sourceKinds'] = {
    bugreport: 0,
    anr: 0,
    tombstone: 0,
    kernel: 0,
    logcat: 0,
    metadata: 0,
    other: 0,
  };

  let bugreportFormat: string | undefined;
  let mainEntry: string | undefined;
  const sections: ReportSection[] = [];

  for (const source of normalized) {
    sourceKinds[source.kind ?? 'other'] += 1;
    const basename = source.name.split('/').pop()?.toLowerCase();
    if (basename === 'version.txt') bugreportFormat = source.text.trim().slice(0, 80) || undefined;
    if (basename === 'main-entry.txt') mainEntry = source.text.trim().slice(0, 300) || undefined;

    if (source.kind !== 'bugreport' && !/bugreport|dumpstate/i.test(source.name)) continue;
    const lines = source.text.split(/\r?\n/);
    let current: Omit<ReportSection, 'endLine'> | undefined;

    const close = (endLine: number) => {
      if (!current) return;
      sections.push({ ...current, endLine: Math.max(current.startLine, endLine) });
      current = undefined;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      const command = line.match(COMMAND_HEADER);
      const group = line.match(GROUP_HEADER);
      const title = command?.[1]?.trim() ?? group?.[1]?.trim();
      if (!title) continue;
      if (/^dumpstate:|^final progress/i.test(title)) continue;
      close(index);
      current = {
        id: `${source.name}:${index + 1}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
        title,
        source: source.name,
        startLine: index + 1,
        kind: sectionKind(title),
      };
    }
    close(lines.length);
  }

  const capabilities = new Set<string>();
  for (const section of sections) {
    if (section.kind === 'logcat') capabilities.add('Logcat buffers');
    if (section.kind === 'kernel') capabilities.add('Kernel / pstore');
    if (section.kind === 'battery') capabilities.add('BatteryStats / power');
    if (section.kind === 'memory') capabilities.add('Memory / PSI');
    if (section.kind === 'network') capabilities.add('Connectivity');
    if (section.kind === 'anr') capabilities.add('ANR traces');
  }
  if (sourceKinds.tombstone) capabilities.add('Native tombstones');
  if (sourceKinds.anr) capabilities.add('Historical ANRs');
  if (sourceKinds.kernel) capabilities.add('Kernel artifacts');

  return {
    bugreportFormat,
    mainEntry,
    sourceKinds,
    sections,
    detectedCapabilities: [...capabilities].sort(),
  };
}
