import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class DisplayAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'display' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const anchors = findMatchingLines(context.lines, [
      /SurfaceFlinger.*(?:fatal|error|failed|unresponsive|timeout|died)/i,
      /Composer.*(?:HAL|service).*(?:died|failed|error|timeout)/i,
      /android\.hardware\.graphics\.composer.*(?:died|failed|error)/i,
      /hwcomposer.*(?:error|failed|timeout|dead)/i,
      /DisplayManager.*(?:error|failed|timeout)/i,
      /drm.*(?:error|timeout|failed|underflow)/i,
      /(?:DSI|MIPI|panel).*(?:timeout|error|failed)/i,
    ], [], 16);
    if (!anchors.length) return [];

    const details = anchors.flatMap((line) => contextAround(context.lines, line, 2, 5));
    const confidence = confidenceFromEvidence(anchors.length, 80, 3);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'display-pipeline'),
      category: this.category,
      severity: 'high',
      title: 'Display pipeline errors detected',
      summary: 'SurfaceFlinger, composer/HWC, DisplayManager, or kernel-display errors appear in the report. The first failing layer matters: application rendering, system composition, vendor composer, and kernel panel/DRM faults require different fixes.',
      confidence,
      evidence: uniqueEvidence(details, 15),
      relatedFindingIds: [],
      recommendedChecks: [
        'Identify the earliest display-layer failure instead of treating later frame drops or watchdogs as separate causes.',
        'Check vendor composer binder/service health and SurfaceFlinger state around the incident.',
        'Inspect kernel DRM/panel/DSI errors when userspace services are waiting on hardware completion.',
        'For UDFPS incidents, check local-HBM/brightness transitions in the same timeline.',
      ],
      tags: ['surfaceflinger', 'composer', 'hwc', 'display'],
    })];
  }
}
