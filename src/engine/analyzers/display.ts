import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import { confidenceFromEvidence, stableFindingId, toEvidence } from '../utils';

export class DisplayAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'display' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const lines = context.lines.filter((line) =>
      /(SurfaceFlinger|DisplayManager|HWComposer|HWC2?|composer|drm|display hal)/i.test(line.text)
      && /(error|failed|fatal|timeout|dead|died|unresponsive|hang|cannot|invalid)/i.test(line.text),
    ).slice(0, 12);

    if (!lines.length) return [];
    return [{
      id: stableFindingId(this.category, 'display-failure'),
      category: this.category,
      severity: 'high',
      title: 'Display pipeline failures detected',
      summary: 'Errors from the display framework, SurfaceFlinger, hardware composer, or related driver paths were detected.',
      confidence: confidenceFromEvidence(lines.length, 74, 3),
      evidence: lines.map(toEvidence),
      relatedFindingIds: [],
      recommendedChecks: [
        'Correlate SurfaceFlinger errors with HWC/composer and kernel display driver messages.',
        'Check whether display failures occur immediately before watchdog, reboot, or UDFPS failures.',
        'Inspect vendor composer service death and binder reconnection behavior.',
      ],
      tags: ['display', 'surfaceflinger', 'hwcomposer'],
    }];
  }
}
