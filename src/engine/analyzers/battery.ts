import type { AnalyzerContext, DiagnosticAnalyzer, Finding, IndexedLine } from '../types';
import {
  confidenceFromEvidence,
  countMatchingLines,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

function durationToMs(value: string): number {
  let total = 0;
  const hours = value.match(/(\d+)h/);
  const minutes = value.match(/(\d+)m(?!s)/);
  const seconds = value.match(/(\d+)s/);
  const millis = value.match(/(\d+)ms/);
  if (hours) total += Number(hours[1]) * 3_600_000;
  if (minutes) total += Number(minutes[1]) * 60_000;
  if (seconds) total += Number(seconds[1]) * 1_000;
  if (millis) total += Number(millis[1]);
  return total;
}

function longWakelockLines(lines: IndexedLine[]): IndexedLine[] {
  const result: IndexedLine[] = [];
  for (const line of lines) {
    if (!/Wake lock .*partial/i.test(line.text)) continue;
    const prefix = line.text.match(/Wake lock .*?:\s*([^,]+?)\s+partial/i)?.[1]
      ?? line.text.match(/Wake lock .*?:\s*([^()]+?)\s*\(/i)?.[1];
    if (!prefix) continue;
    if (durationToMs(prefix) >= 5 * 60_000) result.push(line);
    if (result.length >= 12) break;
  }
  return result;
}

export class BatteryAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'battery' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const longWakelocks = longWakelockLines(context.lines);
    const explicitLongWakeEvents = findMatchingLines(context.lines, [
      /\blongwake\b/i,
      /[+-]Elw=/,
      /Long Wakelock/i,
    ], [], 12);

    if (longWakelocks.length || explicitLongWakeEvents.length) {
      const evidence = [...longWakelocks, ...explicitLongWakeEvents];
      const confidence = confidenceFromEvidence(evidence.length, longWakelocks.length ? 86 : 74, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'long-wakelock'),
        category: this.category,
        severity: longWakelocks.length ? 'high' : 'medium',
        title: 'Long-running wake lock activity detected',
        summary: longWakelocks.length
          ? 'BatteryStats contains partial wake locks lasting at least five minutes. Long-held partial wake locks can keep the CPU from suspending and should be checked against the expected workload and screen-off periods.'
          : 'Battery history records long-wake events. The event itself is a useful lead, but duration and ownership still need to be confirmed from BatteryStats and the surrounding timeline.',
        confidence,
        evidence: uniqueEvidence(evidence, 14),
        relatedFindingIds: [],
        recommendedChecks: [
          'Identify the UID/package and wake-lock name, then compare hold time with the actual feature or job that was running.',
          'Check whether the wake lock overlaps screen-off time, repeated jobs, syncs, alarms, or mobile-radio activity.',
          'Use the BatteryStats collection window as the denominator; a long duration is not automatically abnormal if the device was intentionally active.',
        ],
        tags: ['battery', 'wakelock', 'batterystats'],
      }));
    }

    const wakeReasonCount = countMatchingLines(context.lines, [/wake_reason=/i, /\bwr\b.*wakeup/i]);
    const jobOrSyncBursts = countMatchingLines(context.lines, [/[+-](?:job|sync)=/i, /[+-]E(?:jb|sy)=/]);
    if (wakeReasonCount >= 40 || jobOrSyncBursts >= 80) {
      const lines = findMatchingLines(context.lines, [
        /wake_reason=/i,
        /[+-](?:job|sync)=/i,
        /[+-]E(?:jb|sy)=/,
      ], [], 12);
      const confidence = 68;
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'frequent-wake-activity'),
        category: this.category,
        severity: 'medium',
        title: 'Frequent wake / job / sync activity appears in battery history',
        summary: 'The battery history contains a dense set of wake reasons, jobs, or sync transitions. This is a triage signal rather than proof of battery drain because the report duration and expected workload must be considered.',
        confidence,
        evidence: uniqueEvidence(lines, 12),
        relatedFindingIds: [],
        recommendedChecks: [
          'Measure the observation window and group events by UID/package before judging frequency.',
          'Look for short repeated bursts that prevent long screen-off suspend intervals.',
          'Correlate network/radio activity with the same jobs or sync adapters to find avoidable wakeups.',
        ],
        tags: ['battery', 'wake-reason', 'job', 'sync'],
      }));
    }

    return findings;
  }
}
