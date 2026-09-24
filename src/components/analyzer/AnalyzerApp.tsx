import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResult, Finding, Severity } from '@/engine/types';
import { track } from '@/lib/analytics';
import { resultToText } from '@/lib/report';
import './analyzer.css';

type WorkerMessage =
  | { type: 'progress'; stage: string; progress: number }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; message: string };

const MAX_INPUT_BYTES = 150 * 1024 * 1024;

function severityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="finding-card">
      <div className="finding-head">
        <div>
          <span className={`severity severity-${finding.severity}`}>{severityLabel(finding.severity)}</span>
          <span className="category">{finding.category}</span>
        </div>
        <strong>{finding.confidence}% confidence</strong>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.summary}</p>
      <button className="text-button" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide evidence' : `View evidence (${finding.evidence.length})`}
      </button>
      {expanded && (
        <div className="finding-detail">
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
          <div className="checks">
            <strong>Recommended checks</strong>
            <ul>
              {finding.recommendedChecks.map((check) => <li key={check}>{check}</li>)}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AnalyzerApp({ focusCategory }: { focusCategory?: string }) {
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

  useEffect(() => () => workerRef.current?.terminate(), []);

  const filteredFindings = useMemo(() => {
    if (!result) return [];
    if (!focusCategory) return result.findings;
    const focused = result.findings.filter((finding) => finding.category === focusCategory);
    return focused.length ? focused : result.findings;
  }, [focusCategory, result]);

  const analyze = async (file: File) => {
    if (file.size > MAX_INPUT_BYTES) {
      setError('This MVP accepts files up to 150 MB. Very large reports should be trimmed or analyzed with the engineering review workflow.');
      setStatus('error');
      return;
    }

    workerRef.current?.terminate();
    setFileName(file.name);
    setResult(null);
    setError('');
    setStatus('running');
    setProgress(5);
    setStage('Preparing analysis');
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
        void track(`finding_${category}` as Parameters<typeof track>[0], { category });
      }
      worker.terminate();
    };
    worker.onerror = () => {
      setStatus('error');
      setError('The analysis worker stopped unexpectedly. Try a smaller file or a plain-text extract.');
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
        <div className="drop-icon">⌁</div>
        <h2>{status === 'running' ? 'Analyzing locally…' : 'Drop your Android bugreport here'}</h2>
        <p>{status === 'running' ? stage : 'bugreport.zip, text logs, traces, or diagnostic extracts · up to 150 MB'}</p>
        {status !== 'running' && (
          <button className="button button-primary" type="button" onClick={() => inputRef.current?.click()}>
            Choose diagnostic file
          </button>
        )}
        <div className="privacy-note"><span>●</span> Your diagnostic file stays in this browser. It is not uploaded.</div>
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
              <span className="kicker">Analysis complete</span>
              <h2>{result.findings.length ? `${result.findings.length} diagnostic finding${result.findings.length === 1 ? '' : 's'}` : 'No known critical pattern detected'}</h2>
              <p>{fileName} · {result.sourceSummary.filesRead} source file{result.sourceSummary.filesRead === 1 ? '' : 's'} read locally</p>
            </div>
            <button type="button" className="button" onClick={exportReport}>Export TXT report</button>
          </div>

          <div className="device-grid">
            <div><span>Device</span><strong>{result.metadata.model ?? 'Unknown'}</strong></div>
            <div><span>Android</span><strong>{result.metadata.androidVersion ?? 'Unknown'} {result.metadata.sdk ? `· SDK ${result.metadata.sdk}` : ''}</strong></div>
            <div><span>Build</span><strong>{result.metadata.buildId ?? 'Unknown'}</strong></div>
            <div><span>Boot reason</span><strong>{result.metadata.bootReason ?? 'Not reported'}</strong></div>
          </div>

          {result.sourceSummary.truncatedFiles > 0 && (
            <div className="analysis-warning">Some diagnostic text was truncated to keep browser memory bounded. High-value files are prioritized, but the report may be incomplete.</div>
          )}

          <div className="finding-list">
            {filteredFindings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
          </div>

          {result.findings.length === 0 && (
            <div className="empty-result">
              <h3>No supported failure signature was found.</h3>
              <p>This does not prove the device is healthy. The current MVP detects a defined set of reboot, ANR, crash, kernel, biometric, display, thermal, and boot signatures.</p>
            </div>
          )}

          <div className="engineering-cta">
            <div>
              <span className="kicker">Need deeper root-cause analysis?</span>
              <h3>Get a manual Android / AOSP engineering review.</h3>
              <p>Use the automated report as a starting point, then review BSP, HAL, kernel, framework, and source-level evidence when the incident needs a human investigation.</p>
            </div>
            <a className="button button-primary" href="/contact" onClick={() => void track('cta_clicked')}>Request engineering review</a>
          </div>
        </div>
      )}
    </section>
  );
}
