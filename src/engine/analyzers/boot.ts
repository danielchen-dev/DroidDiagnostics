import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class BootAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'boot' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const anchors = findMatchingLines(context.lines, [
      /init:.*(?:service .* exited|cannot find|failed to start|Could not start)/i,
      /init.*critical process.*exited/i,
      /zygote.*(?:crash|fatal|exited|died)/i,
      /ServiceManager.*waitForService.*timeout/i,
      /boot.*(?:timeout|failed|failure)/i,
      /Failed to mount.*(?:system|vendor|data|metadata)/i,
      /apexd.*(?:fatal|failed)/i,
    ], [], 16);
    if (!anchors.length) return [];

    const details = anchors.flatMap((line) => contextAround(context.lines, line, 2, 6));
    const confidence = confidenceFromEvidence(anchors.length, 80, 3);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'boot-failure'),
      category: this.category,
      severity: 'high',
      title: 'Boot-critical service or initialization failure detected',
      summary: 'Init, zygote, mount, APEX, or boot-service failures appear in the report. In a boot loop, the earliest dependency failure is usually more useful than the many services that fail afterward.',
      confidence,
      evidence: uniqueEvidence(details, 15),
      relatedFindingIds: [],
      recommendedChecks: [
        'Identify the first failed dependency in boot order and verify whether later failures are only cascading effects.',
        'Check mount/fs errors, SELinux denials, APEX activation, properties, and critical vendor services.',
        'Compare failed-boot logs with a known-good boot from the same build when possible.',
      ],
      tags: ['boot', 'init', 'zygote', 'service'],
    })];
  }
}
