import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, findMatchingLines, stableFindingId, toEvidence } from '../utils';

export class ThermalAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'thermal' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const shutdown = findMatchingLines(context.lines, [
      /thermal.*shutdown/i,
      /shutdown.*thermal/i,
      /over.?temperature/i,
      /critical temperature/i,
      /THERMAL_EMERGENCY/i,
    ], [], 10);

    const throttling = findMatchingLines(context.lines, [
      /thermal.*throttl/i,
      /throttl.*thermal/i,
      /temperature.*(?:hot|high)/i,
    ], [/normal/i], 8);

    const findings: Finding[] = [];
    if (shutdown.length) {
      findings.push({
        id: stableFindingId(this.category, 'shutdown'),
        category: this.category,
        severity: 'critical',
        title: 'Thermal shutdown evidence detected',
        summary: 'The logs contain thermal emergency or shutdown indicators that can directly explain an unexpected power-off or reboot.',
        confidence: confidenceFromEvidence(shutdown.length, 88, 3),
        evidence: shutdown.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Identify the thermal zone and sensor that crossed the critical threshold.',
          'Correlate temperature rise with workload, charging, radio, GPU, or display activity.',
        ],
        tags: ['thermal', 'shutdown', 'temperature'],
      });
    } else if (throttling.length) {
      findings.push({
        id: stableFindingId(this.category, 'throttling'),
        category: this.category,
        severity: 'medium',
        title: 'Thermal throttling activity detected',
        summary: 'Thermal pressure or throttling is present. It may be expected under load, but repeated severe throttling can contribute to latency and instability.',
        confidence: confidenceFromEvidence(throttling.length, 68, 3),
        evidence: throttling.map(toEvidence),
        relatedFindingIds: [],
        recommendedChecks: [
          'Check whether throttling coincides with ANRs, watchdog timeouts, or charging.',
          'Compare affected thermal zones against device thermal policy thresholds.',
        ],
        tags: ['thermal', 'throttling'],
      });
    }

    return findings;
  }
}
