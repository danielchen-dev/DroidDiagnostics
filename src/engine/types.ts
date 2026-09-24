export type FindingCategory =
  | 'reboot'
  | 'anr'
  | 'crash'
  | 'kernel'
  | 'biometric'
  | 'display'
  | 'thermal'
  | 'boot'
  | 'battery'
  | 'memory'
  | 'binder'
  | 'storage'
  | 'network'
  | 'selinux';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EvidenceStrength = 'strong' | 'moderate' | 'weak';
export type SourceKind = 'bugreport' | 'anr' | 'tombstone' | 'kernel' | 'logcat' | 'metadata' | 'other';

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
  evidenceStrength: EvidenceStrength;
  evidence: Evidence[];
  relatedFindingIds: string[];
  recommendedChecks: string[];
  tags: string[];
}

export interface DeviceMetadata {
  model?: string;
  manufacturer?: string;
  product?: string;
  device?: string;
  androidVersion?: string;
  sdk?: string;
  buildFingerprint?: string;
  buildId?: string;
  buildType?: string;
  securityPatch?: string;
  kernelVersion?: string;
  bootReason?: string;
  uptime?: string;
}

export interface DiagnosticSource {
  name: string;
  text: string;
  truncated: boolean;
  kind?: SourceKind;
  declaredByMainEntry?: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  source: string;
  startLine: number;
  endLine: number;
  kind:
    | 'logcat'
    | 'dumpsys'
    | 'kernel'
    | 'battery'
    | 'memory'
    | 'network'
    | 'process'
    | 'filesystem'
    | 'anr'
    | 'other';
}

export interface ReportInventory {
  bugreportFormat?: string;
  mainEntry?: string;
  sourceKinds: Record<SourceKind, number>;
  sections: ReportSection[];
  detectedCapabilities: string[];
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
  inventory: ReportInventory;
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
  inventory: ReportInventory;
}

export interface IndexedLine {
  source: string;
  sourceKind?: SourceKind;
  lineNumber: number;
  text: string;
  timestamp?: string;
}

export interface DiagnosticAnalyzer {
  readonly category: FindingCategory;
  analyze(context: AnalyzerContext): Finding[];
}
