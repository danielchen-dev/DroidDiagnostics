import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class BiometricAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'biometric' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const anchors = findMatchingLines(context.lines, [
      /fingerprint.*(?:hw_unavailable|hardware unavailable|error|failed|dead|death)/i,
      /biometric.*(?:hw_unavailable|hardware unavailable|error|failed|dead|death)/i,
      /FingerprintService.*(?:ERROR|failed|died)/i,
      /BiometricService.*(?:ERROR|failed|died)/i,
      /android\.hardware\.biometrics\.fingerprint.*(?:died|failed|error)/i,
      /UDFPS.*(?:error|failed|timeout|HBM)/i,
      /fingerprint.*binder.*died/i,
    ], [], 14);
    if (!anchors.length) return [];

    const details = anchors.flatMap((line) => contextAround(context.lines, line, 2, 5));
    const confidence = confidenceFromEvidence(anchors.length, 80, 3);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'fingerprint-failure'),
      category: this.category,
      severity: 'high',
      title: 'Fingerprint / biometric service failure detected',
      summary: 'The report contains fingerprint or biometric failures spanning framework, HAL, or vendor service paths. For under-display fingerprint sensors, display/HBM coordination must be checked in the same time window.',
      confidence,
      evidence: uniqueEvidence(details, 14),
      relatedFindingIds: [],
      recommendedChecks: [
        'Determine whether the failure begins in BiometricService/FingerprintService or after HAL/vendor-process death.',
        'Check binder death/reconnect messages and whether the sensor provider is re-registered after restart.',
        'For UDFPS, correlate authentication timestamps with display power mode, HBM/local-HBM, SurfaceFlinger, and composer errors.',
        'Separate transient post-reboot unavailability from a persistent hardware or driver communication failure.',
      ],
      tags: ['fingerprint', 'biometric', 'hal', 'udfps'],
    })];
  }
}
