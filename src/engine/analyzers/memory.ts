import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class MemoryAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'memory' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const lmk = findMatchingLines(context.lines, [
      /lmkd.*Killing ['"]?/i,
      /lowmemorykiller.*Kill/i,
      /Kill '.*' \(\d+\), uid \d+, to free/i,
      /memory pressure.*(?:critical|medium)/i,
    ], [], 14);
    if (lmk.length) {
      const details = lmk.flatMap((line) => contextAround(context.lines, line, 1, 4));
      const confidence = confidenceFromEvidence(lmk.length, 84, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'lmkd-kills'),
        category: this.category,
        severity: 'high',
        title: 'Low-memory process killing detected',
        summary: 'lmkd/LMK killed processes to recover memory. Repeated kills around freezes, ANRs, or service restarts indicate system-wide memory pressure or thrashing rather than a single isolated app failure.',
        confidence,
        evidence: uniqueEvidence(details, 14),
        relatedFindingIds: [],
        recommendedChecks: [
          'Inspect PSI memory, vmstat, meminfo, swap/zram, and workingset/refault activity from the same period.',
          'Separate normal cached-process reclamation from kills of important foreground/system processes.',
          'If kills repeat, identify the largest PSS/RSS consumers and whether memory grows over time.',
        ],
        tags: ['memory', 'lmkd', 'pressure'],
      }));
    }

    const oom = findMatchingLines(context.lines, [
      /java\.lang\.OutOfMemoryError/i,
      /Out of memory: Kill process/i,
      /page allocation failure/i,
      /oom_reaper/i,
      /invoked oom-killer/i,
    ], [], 12);
    if (oom.length) {
      const confidence = confidenceFromEvidence(oom.length, 88, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'oom'),
        category: this.category,
        severity: 'critical',
        title: 'Out-of-memory failure detected',
        summary: 'The report contains application or kernel out-of-memory evidence. Determine whether the failure is a process heap limit, native allocation pressure, or device-wide memory exhaustion before selecting a fix.',
        confidence,
        evidence: uniqueEvidence(oom, 12),
        relatedFindingIds: [],
        recommendedChecks: [
          'For Java OOM, inspect heap growth and allocation class rather than only increasing heap size.',
          'For system OOM, inspect meminfo/PSI, zram/swap, kernel allocation failures, and large native/dmabuf consumers.',
        ],
        tags: ['memory', 'oom'],
      }));
    }
    return findings;
  }
}
