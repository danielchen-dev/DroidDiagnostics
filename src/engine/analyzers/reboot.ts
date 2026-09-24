import type { AnalyzerContext, DiagnosticAnalyzer, Finding, IndexedLine } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class RebootAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'reboot' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const watchdog = findMatchingLines(context.lines, [
      /WATCHDOG KILLING SYSTEM PROCESS/i,
      /watchdog.*(?:bite|timeout|triggered|reboot)/i,
      /system_server.*watchdog/i,
      /Watchdog.*overdue/i,
    ], [], 10);

    if (watchdog.length) {
      const expanded: IndexedLine[] = watchdog.flatMap((line) => contextAround(context.lines, line, 2, 4));
      const confidence = confidenceFromEvidence(watchdog.length, 88, 3);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'watchdog'),
        category: this.category,
        severity: 'critical',
        title: 'system_server watchdog recovery was triggered',
        summary: 'The report contains watchdog evidence showing that a monitored system thread or service stopped making progress. The watchdog is the recovery mechanism; the useful root-cause evidence is usually in the blocked thread, binder, I/O, or vendor-service activity immediately before it.',
        confidence,
        evidence: uniqueEvidence(expanded, 12),
        relatedFindingIds: [],
        recommendedChecks: [
          'Start with the first overdue monitor or blocked thread named by Watchdog, not the final reboot line.',
          'Check binder state, process wait channels, storage latency, SurfaceFlinger/composer, and vendor HAL messages from the same window.',
          'Compare repeated incidents for the same lock, service, or kernel wait path.',
        ],
        tags: ['watchdog', 'system_server', 'reboot'],
      }));
    }

    const explicitReasons = findMatchingLines(context.lines, [
      /\[ro\.boot\.bootreason\]:/i,
      /\[sys\.boot\.reason\]:/i,
      /boot[_ -]?reason\s*[:=]/i,
      /reboot_reason\s*[:=]/i,
      /sys\.boot\.reason/i,
    ], [/bootreason[^\n]*(?:unknown|reboot,unknown)/i], 8);

    if (explicitReasons.length || context.metadata.bootReason) {
      const confidence = confidenceFromEvidence(Math.max(1, explicitReasons.length), 78, 3);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'boot-reason'),
        category: this.category,
        severity: 'medium',
        title: 'Boot reason metadata is available',
        summary: context.metadata.bootReason
          ? `The device reports boot reason “${context.metadata.bootReason}”. Treat this as a routing clue and confirm it against pstore/kernel, watchdog, thermal, shutdown-checkpoint, and power evidence.`
          : 'The report contains explicit boot reason records that can narrow the restart path when correlated with kernel and framework evidence.',
        confidence,
        evidence: explicitReasons.map((line) => ({
          source: line.source,
          lineNumber: line.lineNumber,
          timestamp: line.timestamp,
          excerpt: line.text.trim().slice(0, 420),
        })),
        relatedFindingIds: [],
        recommendedChecks: [
          'Vendor boot-reason strings are not sufficient on their own; verify them against the preceding failure evidence.',
          'If the reason suggests panic or watchdog, prioritize pstore/ramoops and the previous-boot kernel log.',
          'If it suggests orderly shutdown, inspect shutdown checkpoints before assuming a crash.',
        ],
        tags: ['bootreason', 'restart', 'metadata'],
      }));
    }

    const shutdownCheckpoints = findMatchingLines(context.lines, [
      /shutdown checkpoint/i,
      /ShutdownThread/i,
      /reboot: Restarting system/i,
      /PowerManagerService.*(?:reboot|shutdown)/i,
    ], [], 8);
    if (shutdownCheckpoints.length) {
      const confidence = confidenceFromEvidence(shutdownCheckpoints.length, 68, 4);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'orderly-shutdown'),
        category: this.category,
        severity: 'low',
        title: 'Orderly shutdown or reboot path appears in the report',
        summary: 'Framework or shutdown-checkpoint records suggest that Android entered an intentional reboot/shutdown path. This can distinguish an orderly restart from a sudden reset, but the trigger still needs to be identified.',
        confidence,
        evidence: shutdownCheckpoints.map((line) => ({ source: line.source, lineNumber: line.lineNumber, timestamp: line.timestamp, excerpt: line.text.trim().slice(0, 420) })),
        relatedFindingIds: [],
        recommendedChecks: [
          'Identify who requested the reboot or shutdown and whether it followed a crash-recovery policy.',
          'Compare against kernel panic/watchdog evidence; sudden resets often lack a complete framework shutdown trail.',
        ],
        tags: ['shutdown', 'reboot', 'checkpoint'],
      }));
    }

    return findings;
  }
}
