import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class RebootAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'reboot' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];

    const watchdog = findMatchingLines(context.lines, [
      /watchdog.*(?:bite|timeout|reboot|triggered)/i,
      /system_server.*watchdog/i,
      /WATCHDOG KILLING SYSTEM PROCESS/i,
    ]);
    if (watchdog.length) {
      findings.push({
        id: stableFindingId(this.category, 'watchdog'),
        category: this.category,
        severity: 'critical',
        title: 'Watchdog-triggered system restart detected',
        summary: 'The log contains watchdog evidence consistent with a system service becoming unresponsive long enough to force recovery or reboot.',
        confidence: confidenceFromEvidence(watchdog.length, 84, 4),
        evidence: watchdog.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Inspect events immediately before the first watchdog line for blocked system services or binder stalls.',
          'Correlate with system_server, SurfaceFlinger, hardware composer, and kernel scheduler messages.',
          'Check whether the same subsystem repeatedly appears before each reboot.',
        ],
        tags: ['watchdog', 'system_server', 'reboot'],
      });
    }

    const explicitReasons = findMatchingLines(context.lines, [
      /ro\.boot\.bootreason/i,
      /sys\.boot\.reason/i,
      /boot reason\s*[:=]/i,
      /reboot_reason/i,
    ], [/unknown/i], 6);
    if (explicitReasons.length || context.metadata.bootReason) {
      findings.push({
        id: stableFindingId(this.category, 'boot-reason'),
        category: this.category,
        severity: 'medium',
        title: 'Boot reason information is available',
        summary: context.metadata.bootReason
          ? `Reported boot reason: ${context.metadata.bootReason}`
          : 'The bugreport contains explicit boot reason records that can narrow the restart cause.',
        confidence: confidenceFromEvidence(Math.max(1, explicitReasons.length), 76, 3),
        evidence: explicitReasons.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Treat vendor boot-reason strings as a clue, then verify them against kernel and framework logs.',
          'Compare the boot reason with panic, watchdog, thermal, or power-reset evidence.',
        ],
        tags: ['bootreason', 'restart'],
      });
    }

    return findings;
  }
}
