import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResult, EvidenceStrength, Finding, FindingCategory, Severity } from '@/engine/types';
import { track } from '@/lib/analytics';
import { resultToText } from '@/lib/report';
import './analyzer.css';

type WorkerMessage =
  | { type: 'progress'; stage: string; progress: number }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; message: string };

const MAX_INPUT_BYTES = 150 * 1024 * 1024;
const ALL_FILTER = 'all';

type FindingFilter = typeof ALL_FILTER | FindingCategory;

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  reboot: 'Reboot',
  anr: 'ANR',
  crash: 'Crash',
  kernel: 'Kernel',
  biometric: 'Biometric',
  display: 'Display',
  thermal: 'Thermal',
  boot: 'Boot',
  battery: 'Battery',
  memory: 'Memory',
  binder: 'Binder',
  storage: 'Storage',
  network: 'Network',
  selinux: 'SELinux',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function severityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

function strengthLabel(strength: EvidenceStrength): string {
  return strength.charAt(0).toUpperCase() + strength.slice(1);
}

function formatCharacters(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M chars`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K chars`;
  return `${value} chars`;
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="finding-card">
      <div className="finding-head">
        <div className="finding-badges">
          <span className={`severity severity-${finding.severity}`}>{severityLabel(finding.severity)}</span>
          <span className="category">{CATEGORY_LABELS[finding.category]}</span>
        </div>
        <span className={`evidence-strength evidence-${finding.evidenceStrength}`}>
          {strengthLabel(finding.evidenceStrength)} evidence
        </span>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.summary}</p>
      <button className="text-button" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide technical detail' : `Inspect evidence (${finding.evidence.length})`}
      </button>
      {expanded && (
        <div className="finding-detail">
          <div className="finding-detail-grid">
            <div>
              <div className="detail-label">Source evidence</div>
              <div className="evidence-list">
                {finding.evidence.map((evidence, index) => (
                  <div className="evidence" key={`${evidence.source}-${evidence.lineNumber}-${index}`}>
                    <div className="evidence-meta">
                      <span>{evidence.source}:{evidence.lineNumber ?? '?'}</span>
                      {evidence.timestamp && <span>{evidence.timestamp}</span>}
                    </div>
                    <code>{evidence.excerpt}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="checks">
              <div className="detail-label">Recommended checks</div>
              <ol>
                {finding.recommendedChecks.map((check) => <li key={check}>{check}</li>)}
              </ol>
              <div className="confidence-footnote">
                Internal signal score: {finding.confidence}/100. This ranks matching evidence; it is not a probability that the finding is the root cause.
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AnalyzerApp({ focusCategory }: { focusCategory?: FindingCategory }) {
  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<FindingFilter>(focusCategory ?? ALL_FILTER);

  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => setActiveFilter(focusCategory ?? ALL_FILTER), [focusCategory]);

  const categories = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.findings.map((finding) => finding.category))];
  }, [result]);

  const filteredFindings = useMemo(() => {
    if (!result) return [];
    if (activeFilter === ALL_FILTER) return result.findings;
    return result.findings.filter((finding) => finding.category === activeFilter);
  }, [activeFilter, result]);

  const severityCounts = useMemo(() => {
    const counts = Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0])) as Record<Severity, number>;
    for (const finding of result?.findings ?? []) counts[finding.severity] += 1;
    return counts;
  }, [result]);

  const analyze = async (file: File) => {
    if (file.size > MAX_INPUT_BYTES) {
      setError('This browser-side build accepts files up to 150 MB. For larger reports, use a reduced diagnostic extract or split the archive before analysis.');
      setStatus('error');
      return;
    }

    workerRef.current?.terminate();
    setFileName(file.name);
    setResult(null);
    setError('');
    setStatus('running');
    setProgress(5);
    setStage('Preparing local parser');
    setActiveFilter(focusCategory ?? ALL_FILTER);
    startRef.current = performance.now();
    void track('analysis_started', { category: focusCategory ?? '' });

    const worker = new Worker(new URL('../../engine/analysis.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        setProgress(message.progress);
        setStage(message.stage);
        return;
      }
      if (message.type === 'error') {
        setStatus('error');
        setError(message.message);
        setProgress(0);
        void track('analysis_failed', { category: focusCategory ?? '' });
        worker.terminate();
        return;
      }

      const durationMs = Math.round(performance.now() - startRef.current);
      setResult(message.result);
      setStatus('done');
      setProgress(100);
      setStage('Analysis complete');
      void track('analysis_completed', { category: focusCategory ?? '', durationMs });
      for (const category of new Set(message.result.findings.map((finding) => finding.category))) {
        void track(`finding_${category}`, { category });
      }
      worker.terminate();
    };
    worker.onerror = () => {
      setStatus('error');
      setError('The analysis worker stopped unexpectedly. Try a smaller archive or a plain-text diagnostic extract.');
      void track('analysis_failed', { category: focusCategory ?? '' });
      worker.terminate();
    };
    worker.postMessage({ type: 'analyze', file });
  };

  const exportReport = () => {
    if (!result) return;
    const blob = new Blob([resultToText(result)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `droiddiagnostics-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    void track('report_exported', { category: focusCategory ?? '' });
  };

  return (
    <section className="analyzer-shell" aria-label="Android diagnostic analyzer">
      <div
        className={`dropzone ${dragging ? 'dropzone-active' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void analyze(file);
        }}
      >
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".zip,.txt,.log,.trace,.out,.prop"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void analyze(file);
          }}
        />
        <div className="parser-status"><span /> Deterministic parser · no LLM</div>
        <div className="drop-icon" aria-hidden="true">⌁</div>
        <h2>{status === 'running' ? 'Reading diagnostic evidence…' : 'Drop an Android bugreport here'}</h2>
        <p>{status === 'running' ? stage : 'bugreport.zip, text logs, ANR traces, tombstone extracts · up to 150 MB'}</p>
        {status !== 'running' && (
          <button className="button button-primary" type="button" onClick={() => inputRef.current?.click()}>
            Choose diagnostic file
          </button>
        )}
        <div className="privacy-note"><span>●</span> The file is parsed in this browser and is not sent to the server.</div>
        {status === 'running' && (
          <div className="progress" aria-label={`Analysis ${progress}% complete`}>
            <div style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {status === 'error' && <div className="analysis-error"><strong>Analysis could not complete.</strong><span>{error}</span></div>}

      {result && (
        <div className="results">
          <div className="result-toolbar">
            <div>
              <span className="kicker">Analysis complete · engine {result.version}</span>
              <h2>{result.findings.length ? `${result.findings.length} finding${result.findings.length === 1 ? '' : 's'} to review` : 'No supported failure signature found'}</h2>
              <p>{fileName} · {result.sourceSummary.filesRead} source file{result.sourceSummary.filesRead === 1 ? '' : 's'} · {formatCharacters(result.sourceSummary.charactersRead)}</p>
            </div>
            <button type="button" className="button" onClick={exportReport}>Export engineering TXT</button>
          </div>

          <div className="result-summary-grid">
            <div className="summary-card"><span>Critical / high</span><strong>{severityCounts.critical + severityCounts.high}</strong><small>Immediate triage candidates</small></div>
            <div className="summary-card"><span>Moderate / low</span><strong>{severityCounts.medium + severityCounts.low}</strong><small>Context and secondary signals</small></div>
            <div className="summary-card"><span>Capabilities</span><strong>{result.inventory.detectedCapabilities.length}</strong><small>Diagnostic data classes detected</small></div>
            <div className="summary-card"><span>Timeline events</span><strong>{result.timeline.length}</strong><small>Timestamped findings</small></div>
          </div>

          <div className="device-grid">
            <div><span>Device</span><strong title={result.metadata.model}>{result.metadata.model ?? 'Unknown'}</strong><small>{[result.metadata.manufacturer, result.metadata.device].filter(Boolean).join(' · ') || 'No device identity'}</small></div>
            <div><span>Android</span><strong>{result.metadata.androidVersion ?? 'Unknown'} {result.metadata.sdk ? `· SDK ${result.metadata.sdk}` : ''}</strong><small>{result.metadata.securityPatch ? `Patch ${result.metadata.securityPatch}` : 'Security patch not reported'}</small></div>
            <div><span>Build</span><strong title={result.metadata.buildFingerprint}>{result.metadata.buildId ?? 'Unknown'}</strong><small>{result.metadata.buildType ?? result.metadata.product ?? 'Build type not reported'}</small></div>
            <div><span>Boot context</span><strong>{result.metadata.bootReason ?? 'Not reported'}</strong><small>{result.metadata.uptime ? `Uptime ${result.metadata.uptime}` : 'Uptime not reported'}</small></div>
          </div>

          <section className="inventory-panel">
            <div className="panel-heading">
              <div><span className="kicker">Report inventory</span><h3>What this archive actually contains</h3></div>
              <a href="/bugreport-format">How bugreport.zip is structured →</a>
            </div>
            <div className="inventory-meta">
              <div><span>Format</span><strong>{result.inventory.bugreportFormat ?? 'Flat / not declared'}</strong></div>
              <div><span>Main entry</span><strong title={result.inventory.mainEntry}>{result.inventory.mainEntry ?? 'Not declared'}</strong></div>
              <div><span>Dumpstate sections</span><strong>{result.inventory.sections.length}</strong></div>
            </div>
            <div className="capability-row">
              {result.inventory.detectedCapabilities.length ? result.inventory.detectedCapabilities.map((capability) => <span key={capability}>{capability}</span>) : <span>No structured capability markers found</span>}
            </div>
            <div className="source-kind-row">
              {Object.entries(result.inventory.sourceKinds)
                .filter(([, count]) => count > 0)
                .map(([kind, count]) => <span key={kind}><strong>{count}</strong> {kind}</span>)}
            </div>
          </section>

          {result.sourceSummary.truncatedFiles > 0 && (
            <div className="analysis-warning">Some diagnostic text was truncated to keep browser memory bounded. High-value entries are prioritized, but absence of a finding should not be treated as proof that the incident is absent.</div>
          )}

          {result.findings.length > 0 && (
            <>
              <div className="finding-toolbar">
                <div>
                  <span className="kicker">Findings</span>
                  <p>Evidence strength reflects how directly the parser matched a known diagnostic signature. It is not a root-cause probability.</p>
                </div>
                <div className="filter-row" aria-label="Filter findings by subsystem">
                  <button className={activeFilter === ALL_FILTER ? 'active' : ''} type="button" onClick={() => setActiveFilter(ALL_FILTER)}>All <span>{result.findings.length}</span></button>
                  {categories.map((category) => {
                    const count = result.findings.filter((finding) => finding.category === category).length;
                    return <button className={activeFilter === category ? 'active' : ''} type="button" key={category} onClick={() => setActiveFilter(category)}>{CATEGORY_LABELS[category]} <span>{count}</span></button>;
                  })}
                </div>
              </div>

              <div className="finding-list">
                {filteredFindings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
              </div>
            </>
          )}

          {result.timeline.length > 0 && (
            <section className="timeline-panel">
              <div className="panel-heading"><div><span className="kicker">Incident timeline</span><h3>Timestamped diagnostic signals</h3></div><span>{result.timeline.length} event{result.timeline.length === 1 ? '' : 's'}</span></div>
              <div className="timeline-list">
                {result.timeline.slice(0, 12).map((event, index) => (
                  <div className="timeline-event" key={`${event.source}-${event.lineNumber}-${index}`}>
                    <span className={`timeline-dot severity-${event.severity}`} />
                    <time>{event.timestamp ?? 'No timestamp'}</time>
                    <div><strong>{event.label}</strong><small>{CATEGORY_LABELS[event.category]} · {event.source}:{event.lineNumber ?? '?'}</small></div>
                  </div>
                ))}
              </div>
              {result.timeline.length > 12 && <div className="timeline-more">{result.timeline.length - 12} additional event{result.timeline.length - 12 === 1 ? '' : 's'} are included in the exported report.</div>}
            </section>
          )}

          {result.findings.length === 0 && (
            <div className="empty-result">
              <h3>No supported failure signature was found.</h3>
              <p>This does not prove the device is healthy. The report may not include the incident window, vendor-specific evidence may use an unknown format, or the failure may need a subsystem parser that is not implemented yet.</p>
              <a href="/bugreport-format">Review what a complete bugreport can contain →</a>
            </div>
          )}

          <div className="engineering-cta">
            <div>
              <span className="kicker">Past automated triage</span>
              <h3>Need a build-specific root-cause review?</h3>
              <p>Use the local report to narrow the incident, then review matching BSP, HAL, kernel, symbols, and source when the evidence is vendor-specific or the failure is production-critical.</p>
            </div>
            <a className="button button-primary" href="/contact" onClick={() => void track('cta_clicked')}>Request engineering review</a>
          </div>
        </div>
      )}
    </section>
  );
}
