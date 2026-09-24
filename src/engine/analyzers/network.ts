import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class NetworkAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'network' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const dataStalls = findMatchingLines(context.lines, [
      /data stall/i,
      /NetworkMonitor.*validation failed/i,
      /DnsResolver.*(?:timeout|failed|error)/i,
      /netd.*(?:fatal|died|failed)/i,
      /wlan\d.*(?:firmware crash|fatal|disassociated|link down)/i,
      /WifiNative.*(?:failure|failed|died)/i,
      /ConnectivityService.*(?:lost|timeout|failure)/i,
    ], [], 16);
    if (!dataStalls.length) return [];

    const confidence = confidenceFromEvidence(dataStalls.length, 68, 3);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'connectivity-failure'),
      category: this.category,
      severity: 'medium',
      title: 'Connectivity failure / data-stall evidence detected',
      summary: 'Network validation, DNS, Wi-Fi, netd, or data-stall errors appear in the report. Connectivity logs are noisy, so this finding is most useful when the timestamps match the user-visible outage.',
      confidence,
      evidence: uniqueEvidence(dataStalls, 14),
      relatedFindingIds: [],
      recommendedChecks: [
        'Correlate the failure with the active transport, network ID, signal state, and validation result.',
        'Separate DNS/validation failure from link-layer disconnects or modem/Wi-Fi firmware resets.',
        'Check whether repeated network wakeups also contribute to battery activity.',
      ],
      tags: ['network', 'wifi', 'dns', 'connectivity'],
    })];
  }
}
