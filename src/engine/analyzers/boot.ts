import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class BootAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'boot' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const failures = findMatchingLines(context.lines, [
      /init:.*(?:failed|cannot|could not)/i,
      /zygote.*(?:crash|died|failed)/i,
      /boot.*(?:failed|timeout)/i,
      /service .* repeatedly crashed/i,
    ], [], 10);

    if (!failures.length) return [];
    return [{
      id: stableFindingId(this.category, 'boot-failure'),
      category: this.category,
      severity: 'high',
      title: 'Boot sequence failures detected',
      summary: 'Initialization, zygote, or boot-service failures were found and may indicate a boot-loop or degraded boot sequence.',
      confidence: confidenceFromEvidence(failures.length, 73, 3),
      evidence: failures.map(toEvidence),
      relatedFindingIds: [],
      recommendedChecks: [
        'Identify the first service or dependency that fails during boot.',
        'Separate primary boot failures from repeated secondary service crashes.',
        'Check SELinux, filesystem, vendor service, and property initialization errors around the same time.',
      ],
      tags: ['boot', 'init', 'zygote'],
    }];
  }
}
