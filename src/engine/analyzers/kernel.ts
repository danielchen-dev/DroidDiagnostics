import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class KernelAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'kernel' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const panic = findMatchingLines(context.lines, [
      /Kernel panic/i,
      /Unable to handle kernel (?:NULL pointer|paging request)/i,
      /Internal error: Oops/i,
      /BUG: unable to handle kernel/i,
      /watchdog bite/i,
      /panic_on_oops/i,
    ], [], 12);

    if (panic.length) {
      const details = panic.flatMap((line) => contextAround(context.lines, line, 3, 12));
      const confidence = confidenceFromEvidence(panic.length, 92, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'panic'),
        category: this.category,
        severity: 'critical',
        title: 'Kernel panic or fatal kernel fault detected',
        summary: 'The diagnostic set contains fatal kernel evidence capable of explaining an abrupt reset. Previous-boot pstore/ramoops is usually more valuable than later Android framework logs for this failure class.',
        confidence,
        evidence: uniqueEvidence(details, 16),
        relatedFindingIds: [],
        recommendedChecks: [
          'Prioritize console-ramoops, pstore, last_kmsg, or equivalent previous-boot kernel artifacts.',
          'Find the first call trace associated with the panic/oops before secondary warnings flood the log.',
          'Match kernel and vendor-module symbols to the exact build and inspect the first subsystem-specific frames.',
        ],
        tags: ['kernel', 'panic', 'pstore', 'ramoops'],
      }));
    }

    const stalls = findMatchingLines(context.lines, [
      /soft lockup/i,
      /hard LOCKUP/i,
      /INFO: task .* blocked for more than/i,
      /hung task/i,
      /RCU.*(?:stall|starvation)/i,
      /rcu_preempt detected stalls/i,
    ], [], 14);
    if (stalls.length) {
      const details = stalls.flatMap((line) => contextAround(context.lines, line, 1, 7));
      const confidence = confidenceFromEvidence(stalls.length, 82, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'stall'),
        category: this.category,
        severity: 'high',
        title: 'Kernel scheduler/RCU stall evidence detected',
        summary: 'A soft/hard lockup, hung task, or RCU stall means kernel work stopped making timely progress. This can surface as ANRs, watchdog resets, frozen display, or delayed binder transactions at higher layers.',
        confidence,
        evidence: uniqueEvidence(details, 14),
        relatedFindingIds: [],
        recommendedChecks: [
          'Inspect the blocked task and call trace, then identify the wait object or driver path.',
          'Correlate with I/O, display, modem, GPU, memory-reclaim, and interrupt activity around the same time.',
          'Do not treat repeated downstream framework timeouts as independent root causes until the kernel stall is explained.',
        ],
        tags: ['kernel', 'stall', 'rcu', 'hung-task'],
      }));
    }

    return findings;
  }
}
