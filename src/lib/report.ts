import type { AnalysisResult } from '@/engine/types';

export function resultToText(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('DroidDiagnostics Analysis Report');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push('');
  lines.push('Device');
  lines.push(`Model: ${result.metadata.model ?? 'Unknown'}`);
  lines.push(`Manufacturer: ${result.metadata.manufacturer ?? 'Unknown'}`);
  lines.push(`Android: ${result.metadata.androidVersion ?? 'Unknown'} (SDK ${result.metadata.sdk ?? 'Unknown'})`);
  lines.push(`Build: ${result.metadata.buildId ?? 'Unknown'}`);
  lines.push(`Boot reason: ${result.metadata.bootReason ?? 'Unknown'}`);
  lines.push('');
  lines.push(`Findings: ${result.findings.length}`);
  lines.push('');

  for (const finding of result.findings) {
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push(`Category: ${finding.category}`);
    lines.push(`Confidence: ${finding.confidence}%`);
    lines.push(finding.summary);
    lines.push('Evidence:');
    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence.source}:${evidence.lineNumber ?? '?'} ${evidence.timestamp ?? ''} ${evidence.excerpt}`.trim());
    }
    lines.push('Recommended checks:');
    for (const check of finding.recommendedChecks) lines.push(`- ${check}`);
    lines.push('');
  }

  lines.push('Privacy: the analyzed diagnostic file remained in the browser.');
  return lines.join('\n');
}
