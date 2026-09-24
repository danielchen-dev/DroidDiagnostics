import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  firstCapture,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class AnrAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'anr' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const anchors = findMatchingLines(context.lines, [
      /\bANR in\s+[\w.:-]+/i,
      /\bam_anr\b/i,
      /Input dispatching timed out/i,
      /Broadcast of Intent.*timed out/i,
      /executing service.*timed out/i,
      /ContentProvider.*not responding/i,
    ], [], 16);
    if (!anchors.length) return [];

    const contextLines = anchors.flatMap((line) => contextAround(context.lines, line, 2, 7));
    const process = firstCapture(contextLines, /ANR in\s+([^\s(]+)/i)
      ?? firstCapture(contextLines, /Process:\s*([^,\s]+)/i);
    const reason = firstCapture(contextLines, /Reason:\s*(.+)$/i)
      ?? firstCapture(contextLines, /(Input dispatching timed out[^\r\n]*)/i);
    const confidence = confidenceFromEvidence(anchors.length, 87, 2);

    return [withEvidenceStrength({
      id: stableFindingId(this.category, `${process ?? 'unknown'}:${reason ?? 'anr'}`),
      category: this.category,
      severity: 'high',
      title: process ? `ANR detected in ${process}` : 'Application or system ANR detected',
      summary: reason
        ? `Recorded reason: ${reason.slice(0, 220)}. Diagnose the ANR from the affected thread state plus system load around the same timestamp; the timeout line alone does not establish whether the fault is in the app or the system.`
        : 'One or more ANR records are present. The main thread, binder threads, scheduling state, memory pressure, and I/O conditions around the timeout are the next evidence to inspect.',
      confidence,
      evidence: uniqueEvidence(contextLines, 14),
      relatedFindingIds: [],
      recommendedChecks: [
        'Open the matching /data/anr/anr_* trace when it is present in the ZIP and inspect the main thread first.',
        'Check whether the main thread is blocked on binder, a monitor/lock, disk I/O, or expensive application work.',
        'Use CPU/process state, PSI, binder diagnostics, and nearby system_server delays to separate an app-local ANR from system-wide pressure.',
        'For input ANRs, verify which window was focused and whether input dispatch was waiting on an unresponsive target.',
      ],
      tags: ['anr', 'timeout', process ?? 'unknown-process'],
    })];
  }
}
