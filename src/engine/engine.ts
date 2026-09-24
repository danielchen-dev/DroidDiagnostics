import { AnrAnalyzer } from './analyzers/anr';
import { BiometricAnalyzer } from './analyzers/biometric';
import { BootAnalyzer } from './analyzers/boot';
import { CrashAnalyzer } from './analyzers/crash';
import { DisplayAnalyzer } from './analyzers/display';
import { KernelAnalyzer } from './analyzers/kernel';
import { RebootAnalyzer } from './analyzers/reboot';
import { ThermalAnalyzer } from './analyzers/thermal';
import { buildTimeline, correlateFindings } from './correlation';
import { parseMetadata } from './metadata';
import type { AnalysisInput, AnalysisResult, DiagnosticAnalyzer } from './types';
import { indexSources, severityRank } from './utils';

const ANALYZERS: DiagnosticAnalyzer[] = [
  new RebootAnalyzer(),
  new AnrAnalyzer(),
  new CrashAnalyzer(),
  new KernelAnalyzer(),
  new BiometricAnalyzer(),
  new DisplayAnalyzer(),
  new ThermalAnalyzer(),
  new BootAnalyzer(),
];

export function analyzeDiagnostics(input: AnalysisInput): AnalysisResult {
  const metadata = parseMetadata(input.sources);
  const lines = indexSources(input.sources);
  const context = { sources: input.sources, lines, metadata };

  const findings = correlateFindings(
    ANALYZERS.flatMap((analyzer) => analyzer.analyze(context))
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence),
  );

  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    metadata,
    findings,
    timeline: buildTimeline(findings),
    sourceSummary: {
      filesRead: input.sources.length,
      charactersRead: input.sources.reduce((sum, source) => sum + source.text.length, 0),
      truncatedFiles: input.sources.filter((source) => source.truncated).length,
    },
  };
}
