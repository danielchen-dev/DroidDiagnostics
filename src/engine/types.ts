export type FindingCategory =
  | 'reboot'
  | 'anr'
  | 'crash'
  | 'kernel'
  | 'biometric'
  | 'display'
  | 'thermal'
  | 'boot';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Evidence {
  source: string;
  lineNumber?: number;
  timestamp?: string;
  excerpt: string;
}

export interface TimelineEvent {
  timestamp?: string;
  category: FindingCategory;
  severity: Severity;
  label: string;
  source: string;
  lineNumber?: number;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  summary: string;
  confidence: number;
  evidence: Evidence[];
  relatedFindingIds: string[];
  recommendedChecks: string[];
  tags: string[];
}

export interface DeviceMetadata {
  model?: string;
  manufacturer?: string;
  androidVersion?: string;
  sdk?: string;
  buildFingerprint?: string;
  buildId?: string;
  securityPatch?: string;
  kernelVersion?: string;
  bootReason?: string;
}

export interface DiagnosticSource {
  name: string;
  text: string;
  truncated: boolean;
}

export interface AnalysisInput {
  sources: DiagnosticSource[];
}

export interface AnalysisResult {
  version: string;
  generatedAt: string;
  metadata: DeviceMetadata;
  findings: Finding[];
  timeline: TimelineEvent[];
  sourceSummary: {
    filesRead: number;
    charactersRead: number;
    truncatedFiles: number;
  };
}

export interface AnalyzerContext {
  sources: DiagnosticSource[];
  lines: IndexedLine[];
  metadata: DeviceMetadata;
}

export interface IndexedLine {
  source: string;
  lineNumber: number;
  text: string;
  timestamp?: string;
}

export interface DiagnosticAnalyzer {
  readonly category: FindingCategory;
  analyze(context: AnalyzerContext): Finding[];
}
