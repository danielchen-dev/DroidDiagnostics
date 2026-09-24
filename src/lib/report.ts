import type { AnalysisResult } from '@/engine/types';

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function resultToText(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('DroidDiagnostics Engineering Triage Report');
  lines.push(`Engine: ${result.version}`);
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push('Parser: deterministic browser-side analysis; no LLM');
  lines.push('');

  lines.push('DEVICE / BUILD');
  lines.push(`Model: ${result.metadata.model ?? 'Unknown'}`);
  lines.push(`Manufacturer: ${result.metadata.manufacturer ?? 'Unknown'}`);
  lines.push(`Product / device: ${result.metadata.product ?? 'Unknown'} / ${result.metadata.device ?? 'Unknown'}`);
  lines.push(`Android: ${result.metadata.androidVersion ?? 'Unknown'} (SDK ${result.metadata.sdk ?? 'Unknown'})`);
  lines.push(`Build: ${result.metadata.buildId ?? 'Unknown'} (${result.metadata.buildType ?? 'type unknown'})`);
  lines.push(`Fingerprint: ${result.metadata.buildFingerprint ?? 'Unknown'}`);
  lines.push(`Security patch: ${result.metadata.securityPatch ?? 'Unknown'}`);
  lines.push(`Kernel: ${result.metadata.kernelVersion ?? 'Unknown'}`);
  lines.push(`Boot reason: ${result.metadata.bootReason ?? 'Unknown'}`);
  lines.push(`Uptime: ${result.metadata.uptime ?? 'Unknown'}`);
  lines.push('');

  lines.push('REPORT INVENTORY');
  lines.push(`Bugreport format: ${result.inventory.bugreportFormat ?? 'Not declared'}`);
  lines.push(`Main entry: ${result.inventory.mainEntry ?? 'Not declared'}`);
  lines.push(`Files read: ${result.sourceSummary.filesRead}`);
  lines.push(`Characters read: ${result.sourceSummary.charactersRead}`);
  lines.push(`Truncated files: ${result.sourceSummary.truncatedFiles}`);
  lines.push(`Dumpstate sections indexed: ${result.inventory.sections.length}`);
  lines.push(`Capabilities: ${result.inventory.detectedCapabilities.join(', ') || 'None detected'}`);
  lines.push(`Source kinds: ${Object.entries(result.inventory.sourceKinds).filter(([, count]) => count > 0).map(([kind, count]) => `${kind}=${count}`).join(', ') || 'none'}`);
  lines.push('');

  lines.push(`FINDINGS (${result.findings.length})`);
  lines.push('Evidence strength is a parser assessment of signature quality, not a probability that the finding is the root cause.');
  lines.push('');

  for (const finding of result.findings) {
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push(`Category: ${finding.category}`);
    lines.push(`Evidence strength: ${title(finding.evidenceStrength)}`);
    lines.push(`Internal signal score: ${finding.confidence}/100`);
    lines.push(finding.summary);
    lines.push('Evidence:');
    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence.source}:${evidence.lineNumber ?? '?'} ${evidence.timestamp ?? ''} ${evidence.excerpt}`.trim());
    }
    lines.push('Recommended checks:');
    for (const check of finding.recommendedChecks) lines.push(`- ${check}`);
    if (finding.relatedFindingIds.length) lines.push(`Related findings: ${finding.relatedFindingIds.join(', ')}`);
    lines.push('');
  }

  if (result.timeline.length) {
    lines.push('INCIDENT TIMELINE');
    for (const event of result.timeline) {
      lines.push(`- ${event.timestamp ?? 'no timestamp'} [${event.severity.toUpperCase()}] ${event.label} (${event.category}) ${event.source}:${event.lineNumber ?? '?'}`);
    }
    lines.push('');
  }

  lines.push('LIMITATIONS');
  lines.push('- Absence of a signature does not prove absence of the failure. Buffers may rotate and vendor formats vary.');
  lines.push('- Build-specific native or kernel root cause may require exact symbols/source and reproduction.');
  lines.push('- Automated output is triage evidence and should be verified against the complete incident timeline.');
  lines.push('');
  lines.push('Privacy: the analyzed diagnostic file remained in the browser.');
  return lines.join('\n');
}
