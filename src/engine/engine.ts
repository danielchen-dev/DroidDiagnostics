import { AnrAnalyzer } from './analyzers/anr';
import { BatteryAnalyzer } from './analyzers/battery';
import { BiometricAnalyzer } from './analyzers/biometric';
import { BinderAnalyzer } from './analyzers/binder';
import { BootAnalyzer } from './analyzers/boot';
import { CrashAnalyzer } from './analyzers/crash';
import { DisplayAnalyzer } from './analyzers/display';
import { KernelAnalyzer } from './analyzers/kernel';
import { MemoryAnalyzer } from './analyzers/memory';
import { NetworkAnalyzer } from './analyzers/network';
import { RebootAnalyzer } from './analyzers/reboot';
import { SelinuxAnalyzer } from './analyzers/selinux';
import { StorageAnalyzer } from './analyzers/storage';
import { ThermalAnalyzer } from './analyzers/thermal';
import { buildTimeline, correlateFindings } from './correlation';
import { parseMetadata } from './metadata';
import { buildReportInventory, normalizeSourceKinds } from './sections';
import type { AnalysisInput, AnalysisResult, DiagnosticAnalyzer } from './types';
import { indexSources, severityRank } from './utils';

const ANALYZERS: DiagnosticAnalyzer[] = [
  new RebootAnalyzer(),
  new AnrAnalyzer(),
  new CrashAnalyzer(),
  new KernelAnalyzer(),
  new BinderAnalyzer(),
  new MemoryAnalyzer(),
  new StorageAnalyzer(),
  new BiometricAnalyzer(),
  new DisplayAnalyzer(),
  new ThermalAnalyzer(),
  new BatteryAnalyzer(),
  new NetworkAnalyzer(),
  new SelinuxAnalyzer(),
  new BootAnalyzer(),
];

export function analyzeDiagnostics(input: AnalysisInput): AnalysisResult {
  const sources = normalizeSourceKinds(input.sources);
  const metadata = parseMetadata(sources);
  const inventory = buildReportInventory(sources);
  const lines = indexSources(sources);
  const context = { sources, lines, metadata, inventory };

  const findings = correlateFindings(
    ANALYZERS.flatMap((analyzer) => analyzer.analyze(context))
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence),
  );

  return {
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    metadata,
    findings,
    timeline: buildTimeline(findings),
    inventory,
    sourceSummary: {
      filesRead: sources.length,
      charactersRead: sources.reduce((sum, source) => sum + source.text.length, 0),
      truncatedFiles: sources.filter((source) => source.truncated).length,
    },
  };
}
