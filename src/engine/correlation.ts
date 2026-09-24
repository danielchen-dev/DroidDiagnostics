import type { Finding, FindingCategory, TimelineEvent } from './types';
import { severityRank } from './utils';

const RELATIONSHIPS: Array<[FindingCategory, FindingCategory]> = [
  ['reboot', 'kernel'],
  ['reboot', 'thermal'],
  ['reboot', 'display'],
  ['reboot', 'boot'],
  ['reboot', 'storage'],
  ['anr', 'binder'],
  ['anr', 'memory'],
  ['anr', 'storage'],
  ['crash', 'memory'],
  ['crash', 'selinux'],
  ['kernel', 'storage'],
  ['biometric', 'display'],
  ['biometric', 'binder'],
  ['biometric', 'selinux'],
  ['display', 'binder'],
  ['display', 'kernel'],
  ['boot', 'selinux'],
  ['boot', 'storage'],
  ['battery', 'thermal'],
  ['battery', 'network'],
  ['memory', 'binder'],
];

export function correlateFindings(findings: Finding[]): Finding[] {
  const byCategory = new Map<FindingCategory, Finding[]>();
  for (const finding of findings) {
    const bucket = byCategory.get(finding.category) ?? [];
    bucket.push(finding);
    byCategory.set(finding.category, bucket);
  }

  for (const [left, right] of RELATIONSHIPS) {
    const leftFindings = byCategory.get(left) ?? [];
    const rightFindings = byCategory.get(right) ?? [];
    for (const a of leftFindings) {
      for (const b of rightFindings) {
        if (!a.relatedFindingIds.includes(b.id)) a.relatedFindingIds.push(b.id);
        if (!b.relatedFindingIds.includes(a.id)) b.relatedFindingIds.push(a.id);
      }
    }
  }
  return findings;
}

export function buildTimeline(findings: Finding[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const finding of findings) {
    for (const evidence of finding.evidence.slice(0, 4)) {
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
    .filter((event) => event.timestamp)
    .sort((a, b) => {
      const timestampOrder = (a.timestamp ?? '').localeCompare(b.timestamp ?? '');
      if (timestampOrder !== 0) return timestampOrder;
      return severityRank(b.severity) - severityRank(a.severity);
    })
    .slice(0, 80);
}
