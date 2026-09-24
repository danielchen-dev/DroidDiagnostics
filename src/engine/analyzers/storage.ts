import type { AnalyzerContext, DiagnosticAnalyzer, Finding } from '../types';
import {
  confidenceFromEvidence,
  contextAround,
  findMatchingLines,
  stableFindingId,
  uniqueEvidence,
  withEvidenceStrength,
} from '../utils';

export class StorageAnalyzer implements DiagnosticAnalyzer {
  readonly category = 'storage' as const;

  analyze(context: AnalyzerContext): Finding[] {
    const ioErrors = findMatchingLines(context.lines, [
      /I\/O error, dev/i,
      /Buffer I\/O error/i,
      /blk_update_request.*I\/O error/i,
      /mmc.*(?:error|timeout|failed)/i,
      /ufs.*(?:error|timeout|fatal)/i,
      /EXT4-fs (?:error|warning)/i,
      /F2FS-fs.*(?:error|corrupt|fatal)/i,
      /dm-verity.*(?:corruption|verification failed|error)/i,
      /Remounting filesystem read-only/i,
    ], [], 16);
    if (!ioErrors.length) return [];

    const details = ioErrors.flatMap((line) => contextAround(context.lines, line, 1, 5));
    const confidence = confidenceFromEvidence(ioErrors.length, 86, 2);
    return [withEvidenceStrength({
      id: stableFindingId(this.category, 'io-filesystem'),
      category: this.category,
      severity: 'critical',
      title: 'Storage / filesystem I/O errors detected',
      summary: 'Block-device, UFS/eMMC, ext4/f2fs, or dm-verity errors appear in the report. Storage faults can cascade into ANRs, boot failures, database corruption, and watchdogs, so they should be triaged before higher-layer symptoms.',
      confidence,
      evidence: uniqueEvidence(details, 15),
      relatedFindingIds: [],
      recommendedChecks: [
        'Identify the affected block device, partition, and first error before retries or filesystem recovery messages.',
        'Check kernel I/O latency, filesystem state, storaged output, mount status, and device-health/vendor telemetry.',
        'Treat read-only remounts or verified-boot corruption as integrity failures, not normal application errors.',
      ],
      tags: ['storage', 'io', 'filesystem'],
    })];
  }
}
