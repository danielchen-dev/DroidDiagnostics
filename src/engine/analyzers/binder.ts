import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class BinderAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'binder' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const failures = findMatchingLines(context.lines, [
      /FAILED BINDER TRANSACTION/i,
      /binder.*transaction failed/i,
      /binder_alloc.*(?:no space|failed|buffer)/i,
      /TransactionTooLargeException/i,
      /DeadObjectException/i,
      /binder:.*undelivered transaction/i,
    ], [], 16);
    if (!failures.length) return [];

    const critical = failures.some((line) => /no space|FAILED BINDER TRANSACTION|binder_alloc/i.test(line.text));
    const confidence = confidenceFromEvidence(failures.length, 78, 3);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'transaction-failure'),
      category: this.category,
      severity: critical ? 'high' : 'medium',
      title: 'Binder IPC failure evidence detected',
      summary: 'Binder transaction failures, dead objects, or oversized IPC payloads appear in the report. These can be a direct application error or a downstream symptom of service death, memory pressure, or system_server/vendor-service stalls.',
      confidence,
      evidence: uniqueEvidence(failures, 15),
      relatedFindingIds: [],
      recommendedChecks: [
        'Check the failed transaction log and identify the sender/target process when the report includes binder diagnostics.',
        'For TransactionTooLargeException, inspect payload/bundle size instead of retrying the same call.',
        'For DeadObjectException, find the target service death that occurred first.',
        'If binder failures coincide with ANR/watchdog, inspect binder thread-pool saturation and blocked server threads.',
      ],
      tags: ['binder', 'ipc', 'transaction'],
    })];
  }
}
