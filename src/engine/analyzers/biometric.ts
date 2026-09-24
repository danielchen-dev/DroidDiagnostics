import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, stableFindingId, toEvidence } from '../utils';

export class BiometricAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'biometric' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const lines = context.lines.filter((line) =>
      /(fingerprint|biometric|udfps|fingerprintservice)/i.test(line.text)
      && /(error|failed|dead|died|timeout|unavailable|cannot|hw_unavailable|binder.*death)/i.test(line.text),
    ).slice(0, 12);

    if (!lines.length) return [];
    return [{
      id: stableFindingId(this.category, 'service-failure'),
      category: this.category,
      severity: 'high',
      title: 'Biometric or fingerprint subsystem failures detected',
      summary: 'Fingerprint/biometric errors were found. Failures after a reboot can involve framework service state, HAL death, vendor communication, or display/UDFPS coordination.',
      confidence: confidenceFromEvidence(lines.length, 76, 3),
      evidence: lines.map(toEvidence),
      relatedFindingIds: [],
      recommendedChecks: [
        'Check for fingerprint HAL binder death or service restart around the first error.',
        'For UDFPS devices, correlate biometric failures with display, HBM, and SurfaceFlinger events.',
        'Verify whether the sensor recovers after framework or device restart.',
      ],
      tags: ['fingerprint', 'biometric', 'hal', 'udfps'],
    }];
  }
}
