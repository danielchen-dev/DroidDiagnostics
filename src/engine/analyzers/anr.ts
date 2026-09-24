import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class AnrAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'anr' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const lines = findMatchingLines(context.lines, [
      /\bANR in\s+[\w.:-]+/i,
      /\bam_anr\b/i,
      /Input dispatching timed out/i,
      /Broadcast of Intent.*timed out/i,
    ], [], 12);

    if (!lines.length) return [];
    return [{
      id: stableFindingId(this.category, 'anr'),
      category: this.category,
      severity: 'high',
      title: 'Application or system ANR evidence detected',
      summary: 'One or more Application Not Responding events were found. The evidence should be correlated with main-thread, binder, CPU, and I/O activity around the same timestamps.',
      confidence: confidenceFromEvidence(lines.length, 82, 3),
      evidence: lines.map(toEvidence),
      relatedFindingIds: [],
      recommendedChecks: [
        'Inspect the affected process main thread and binder threads around the ANR timestamp.',
        'Check for input dispatch, broadcast, service, or content-provider timeout context.',
        'Look for CPU starvation, lock contention, binder exhaustion, or storage stalls nearby.',
      ],
      tags: ['anr', 'timeout', 'main-thread'],
    }];
  }
}
