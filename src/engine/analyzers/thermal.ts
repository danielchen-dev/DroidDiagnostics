import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  findMatchingLines,
  stableFindingId,
  withEvidenceStrength,
} from '../utils';

export class ThermalAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'thermal' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const shutdown = findMatchingLines(context.lines, [
      /thermal.*shutdown/i,
      /shutdown.*thermal/i,
      /THERMAL_EMERGENCY/i,
      /critical temperature/i,
      /over.?temperature.*(?:shutdown|critical)/i,
    ], [], 12);

    const throttling = findMatchingLines(context.lines, [
      /thermal.*throttl/i,
      /throttl.*thermal/i,
      /thermal status.*(?:severe|critical|emergency|shutdown)/i,
    ], [], 10);

    const findings: Finding[] = [];
    if (shutdown.length) {
      const confidence = confidenceFromEvidence(shutdown.length, 90, 2);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'shutdown'),
        category: this.category,
        severity: 'critical',
        title: 'Thermal emergency / shutdown evidence detected',
        summary: 'The report contains explicit critical thermal or shutdown markers. This is stronger evidence than a merely high temperature reading and can directly explain a power-off or restart.',
        confidence,
        evidence: shutdown.map((line) => ({ source: line.source, lineNumber: line.lineNumber, timestamp: line.timestamp, excerpt: line.text.trim().slice(0, 420) })),
        relatedFindingIds: [],
        recommendedChecks: [
          'Identify the thermal zone/sensor and policy state that reached the critical threshold.',
          'Correlate charging, radio, CPU/GPU load, display brightness, and ambient conditions with the event.',
          'Verify whether the device performed an orderly thermal shutdown or a separate reset occurred at the same time.',
        ],
        tags: ['thermal', 'shutdown', 'temperature'],
      }));
    } else if (throttling.length) {
      const confidence = confidenceFromEvidence(throttling.length, 72, 3);
      findings.push(withEvidenceStrength({
        id: stableFindingId(this.category, 'throttling'),
        category: this.category,
        severity: 'medium',
        title: 'Severe thermal throttling activity detected',
        summary: 'Thermal mitigation reached a severe state. Throttling itself can be expected under load, so it should be correlated with latency, ANRs, charging, and sustained workload before being treated as a root cause.',
        confidence,
        evidence: throttling.map((line) => ({ source: line.source, lineNumber: line.lineNumber, timestamp: line.timestamp, excerpt: line.text.trim().slice(0, 420) })),
        relatedFindingIds: [],
        recommendedChecks: [
          'Compare the thermal event against ANR/watchdog timestamps and workload transitions.',
          'Inspect which cooling devices and performance limits were applied.',
        ],
        tags: ['thermal', 'throttling'],
      }));
    }
    return findings;
  }
}
