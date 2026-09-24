import type { Finding, TimelineEvent } from './types';
import { severityRank } from './utils';

export function correlateFindings(findings: Finding[]): Finding[] {
  const byCategory = new Map(findings.map((finding) => [finding.category, finding]));

  const link = (a: string, b: string) => {
    const first = byCategory.get(a as Finding['category']);
    const second = byCategory.get(b as Finding['category']);
    if (!first || !second) return;
    if (!first.relatedFindingIds.includes(second.id)) first.relatedFindingIds.push(second.id);
    if (!second.relatedFindingIds.includes(first.id)) second.relatedFindingIds.push(first.id);
  };

  link('reboot', 'kernel');
  link('reboot', 'thermal');
  link('reboot', 'display');
  link('reboot', 'biometric');
  link('display', 'biometric');
  link('anr', 'kernel');
  link('anr', 'display');
  link('boot', 'crash');

  return findings;
}

export function buildTimeline(findings: Finding[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const finding of findings) {
    for (const evidence of finding.evidence) {
      events.push({
        timestamp: evidence.timestamp,
        category: finding.category,
        severity: finding.severity,
        label: finding.title,
        source: evidence.source,
        lineNumber: evidence.lineNumber,
      });
    }
  }

  return events
    .sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      return severityRank(b.severity) - severityRank(a.severity);
    })
    .slice(0, 80);
}
