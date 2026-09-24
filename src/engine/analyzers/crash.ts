import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class CrashAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'crash' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const javaCrashes = findMatchingLines(context.lines, [
      /FATAL EXCEPTION:/i,
      /AndroidRuntime: FATAL EXCEPTION/i,
      /Process: [\w.:-]+, PID: \d+/i,
    ], [], 10);

    const nativeCrashes = findMatchingLines(context.lines, [
      /Fatal signal \d+/i,
      /^\*\*\* \*\*\* \*\*\* \*\*\*/,
      /backtrace:/i,
      /DEBUG\s*: pid: \d+.*tid:/i,
    ], [], 10);

    const findings: Finding[] = [];
    if (javaCrashes.length) {
      findings.push({
        id: stableFindingId(this.category, 'java'),
        category: this.category,
        severity: 'high',
        title: 'Java/Kotlin fatal exception detected',
        summary: 'A fatal Android runtime exception is present in the diagnostic data.',
        confidence: confidenceFromEvidence(javaCrashes.length, 85, 3),
        evidence: javaCrashes.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Locate the first application-owned stack frame below the exception.',
          'Confirm whether the crash is repeated for the same process and code path.',
          'Check whether a system or vendor service failure preceded the application crash.',
        ],
        tags: ['java', 'androidruntime', 'fatal-exception'],
      });
    }

    if (nativeCrashes.length) {
      findings.push({
        id: stableFindingId(this.category, 'native'),
        category: this.category,
        severity: 'critical',
        title: 'Native process crash evidence detected',
        summary: 'Native fatal-signal or tombstone-style records were found and may require symbolized stack analysis.',
        confidence: confidenceFromEvidence(nativeCrashes.length, 82, 3),
        evidence: nativeCrashes.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Identify the crashed process, signal, fault address, and abort message.',
          'Use matching symbols for the exact build when native addresses need symbolization.',
          'Correlate HAL or vendor process crashes with framework service failures.',
        ],
        tags: ['native', 'tombstone', 'fatal-signal'],
      });
    }

    return findings;
  }
}
