/// <reference lib="webworker" />
import { analyzeDiagnostics } from './engine';
import { loadDiagnosticFile } from './io/source-loader';

interface AnalyzeRequest {
  type: 'analyze';
  file: File;
}

self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  if (event.data.type !== 'analyze') return;
  try {
    self.postMessage({ type: 'progress', stage: 'Reading diagnostic files', progress: 15 });
    const sources = await loadDiagnosticFile(event.data.file);
    self.postMessage({ type: 'progress', stage: `Analyzing ${sources.length} diagnostic source${sources.length === 1 ? '' : 's'}`, progress: 55 });
    const result = analyzeDiagnostics({ sources });
    self.postMessage({ type: 'progress', stage: 'Building report', progress: 90 });
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Analysis failed.',
    });
  }
};
