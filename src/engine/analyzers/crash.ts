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

export class CrashAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'crash' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const javaAnchors = findMatchingLines(context.lines, [
      /FATAL EXCEPTION:/i,
      /AndroidRuntime.*FATAL EXCEPTION/i,
      /Process:\s*[\w.:-]+,\s*PID:\s*\d+/i,
    ], [], 14);

    if (javaAnchors.length) {
      const details = javaAnchors.flatMap((line) => contextAround(context.lines, line, 1, 8));
      const process = firstCapture(details, /Process:\s*([^,\s]+)/i);
      const exception = firstCapture(details, /^\s*(?:Caused by:\s*)?([\w.$]+(?:Exception|Error))(?::|\s|$)/i);
      const confidence = confidenceFromEvidence(javaAnchors.length, 87, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, `java:${process ?? ''}:${exception ?? ''}`),
        category: this.category,
        severity: 'high',
        title: process ? `Java/Kotlin crash in ${process}` : 'Java/Kotlin fatal exception detected',
        summary: exception
          ? `${exception} appears in the fatal Android runtime path. The first application-owned frame and the deepest relevant “Caused by” chain are more useful than the FATAL EXCEPTION banner itself.`
          : 'A fatal Android runtime exception is present. Inspect the exception chain and the first code frame owned by the crashing component.',
        confidence,
        evidence: uniqueEvidence(details, 14),
        relatedFindingIds: [],
        recommendedChecks: [
          'Follow nested “Caused by” entries to the deepest relevant exception.',
          'Identify the first application/vendor-owned frame rather than stopping at framework dispatch code.',
          'Check for repeated crashes of the same process and for lower-level service failures that precede them.',
        ],
        tags: ['java', 'androidruntime', exception ?? 'fatal-exception'],
      }));
    }

    const nativeAnchors = findMatchingLines(context.lines, [
      /Fatal signal\s+\d+/i,
      /^\*\*\* \*\*\* \*\*\* \*\*\*/,
      /signal\s+\d+\s+\(SIG[A-Z]+\)/,
      /Abort message:/i,
      /Tombstone written to:/i,
    ], [], 18);

    if (nativeAnchors.length || context.inventory.sourceKinds.tombstone > 0) {
      const anchor = nativeAnchors[0];
      const details = anchor ? contextAround(context.lines, anchor, 5, 18) : context.lines.filter((line) => line.sourceKind === 'tombstone').slice(0, 18);
      const process = firstCapture(details, />>>\s*([^<]+?)\s*<<</)
        ?? firstCapture(details, /name:\s*([^\s]+)\s+>>>/i);
      const signal = firstCapture(details, /signal\s+\d+\s+\((SIG[A-Z]+)\)/i)
        ?? firstCapture(details, /Fatal signal\s+\d+\s+\((SIG[A-Z]+)\)/i);
      const abortMessage = firstCapture(details, /Abort message:\s*['"]?(.+?)['"]?\s*$/i);
      const confidence = Math.max(86, confidenceFromEvidence(nativeAnchors.length, 82, 2));
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, `native:${process ?? ''}:${signal ?? ''}:${abortMessage ?? ''}`),
        category: this.category,
        severity: 'critical',
        title: process ? `Native crash in ${process}${signal ? ` (${signal})` : ''}` : 'Native crash / tombstone evidence detected',
        summary: abortMessage
          ? `Abort message: ${abortMessage.slice(0, 240)}. Tombstones provide the crash thread, all-thread backtraces, registers, memory map, and BuildId context needed for symbol-aware diagnosis.`
          : 'Native fatal-signal or tombstone evidence is present. Signal, fault address, abort message, BuildId, and the crashing-thread backtrace are the primary fields to preserve.',
        confidence,
        evidence: uniqueEvidence(details.length ? details : nativeAnchors, 16),
        relatedFindingIds: [],
        recommendedChecks: [
          'Record the process, crashing tid, signal/code, fault address, abort message, ABI, and BuildId.',
          'Symbolize against unstripped binaries from the exact build; mismatched symbols can produce misleading stacks.',
          'For SIGABRT, inspect fatal logs immediately before the abort. For SIGSEGV/SIGBUS, inspect the fault address and first non-libc frames.',
        ],
        tags: ['native', 'tombstone', signal ?? 'fatal-signal'],
      }));
    }

    return findings;
  }
}
