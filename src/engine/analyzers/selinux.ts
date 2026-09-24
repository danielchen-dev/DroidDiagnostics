import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class SelinuxAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'selinux' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const denials = findMatchingLines(context.lines, [
      /avc:\s+denied/i,
      /type=1400.*avc:\s+denied/i,
    ], [/permissive=1/i], 18);
    if (!denials.length) return [];

    const confidence = confidenceFromEvidence(denials.length, 76, 2);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'avc-denied'),
      category: this.category,
      severity: denials.length >= 6 ? 'high' : 'medium',
      title: 'SELinux AVC denials detected',
      summary: 'Enforcing-mode access denials are present. A denial is important when it aligns with the failing service or operation; unrelated denials can also exist in noisy vendor builds, so source/target contexts and timestamps matter.',
      confidence,
      evidence: uniqueEvidence(denials, 16),
      relatedFindingIds: [],
      recommendedChecks: [
        'Read the denied permission together with scontext, tcontext, tclass, comm, and path/name fields.',
        'Verify whether the denial occurs at the same time as the failed service, boot stage, biometric operation, or hardware access.',
        'Fix the component or policy deliberately; do not treat permissive mode as a production solution.',
      ],
      tags: ['selinux', 'avc', 'policy'],
    })];
  }
}
