import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class KernelAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'kernel' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const panic = findMatchingLines(context.lines, [
      /Kernel panic/i,
      /panic_on_oops/i,
      /Unable to handle kernel/i,
      /watchdog bite/i,
      /BUG:.*(?:kernel|sleeping function|scheduling while atomic)/i,
    ], [], 10);

    const stalls = findMatchingLines(context.lines, [
      /soft lockup/i,
      /hard LOCKUP/i,
      /hung task/i,
      /blocked for more than \d+ seconds/i,
      /RCU.*stall/i,
    ], [], 10);

    const findings: Finding[] = [];
    if (panic.length) {
      findings.push({
        id: stableFindingId(this.category, 'panic'),
        category: this.category,
        severity: 'critical',
        title: 'Kernel panic or fatal kernel fault evidence detected',
        summary: 'The diagnostic data contains kernel-level fatal fault indicators that can explain abrupt resets or severe device instability.',
        confidence: confidenceFromEvidence(panic.length, 90, 2),
        evidence: panic.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Capture pstore/ramoops or last-kmsg data if available.',
          'Inspect the first faulting stack and subsystem before secondary errors appear.',
          'Verify that kernel symbols and vendor modules match the exact build.',
        ],
        tags: ['kernel', 'panic', 'ramoops'],
      });
    }

    if (stalls.length) {
      findings.push({
        id: stableFindingId(this.category, 'stall'),
        category: this.category,
        severity: 'high',
        title: 'Kernel stall or lockup evidence detected',
        summary: 'Scheduler, RCU, or blocked-task warnings suggest a kernel-side stall that may contribute to watchdog resets or severe latency.',
        confidence: confidenceFromEvidence(stalls.length, 80, 3),
        evidence: stalls.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Inspect the blocked task stack and owner of any contended lock.',
          'Correlate stall timestamps with storage, display, modem, or driver activity.',
        ],
        tags: ['kernel', 'stall', 'lockup'],
      });
    }

    return findings;
  }
}
