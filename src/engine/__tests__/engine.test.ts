import { describe, expect, it } from 'vitest';
import { analyzeDiagnostics } from '../engine';

function analyze(text: string) {
  return analyzeDiagnostics({ sources: [{ name: 'bugreport-test.txt', text, truncated: false }] });
}

describe('DroidDiagnostics engine', () => {
  it('extracts device metadata and watchdog reboot evidence', () => {
    const result = analyze(`
[ro.product.model]: [H300]
[ro.product.manufacturer]: [ExampleVendor]
[ro.build.version.release]: [16]
[ro.build.version.sdk]: [36]
[ro.build.id]: [TEST123]
[ro.boot.bootreason]: [watchdog]
09-24 10:10:10.111  1000  1000 E Watchdog: WATCHDOG KILLING SYSTEM PROCESS: Blocked in monitor
09-24 10:10:10.222  1000  1000 E system_server: watchdog timeout triggered reboot
`);
    expect(result.metadata.model).toBe('H300');
    expect(result.metadata.androidVersion).toBe('16');
    expect(result.findings.some((finding) => finding.category === 'reboot' && finding.severity === 'critical')).toBe(true);
  });

  it('detects ANR and Java crash evidence', () => {
    const result = analyze(`
09-24 11:00:00.001  1000  1000 E ActivityManager: ANR in com.example.app
09-24 11:00:00.101  2000  2000 E AndroidRuntime: FATAL EXCEPTION: main
09-24 11:00:00.102  2000  2000 E AndroidRuntime: Process: com.example.app, PID: 2000
`);
    expect(result.findings.some((finding) => finding.category === 'anr')).toBe(true);
    expect(result.findings.some((finding) => finding.category === 'crash')).toBe(true);
  });

  it('detects kernel and related display/biometric failures', () => {
    const result = analyze(`
09-24 12:00:00.001 kernel: Kernel panic - not syncing: fatal exception
09-24 12:00:00.101 SurfaceFlinger: composer service died, display error
09-24 12:00:00.201 FingerprintService: fingerprint HAL died: HW_UNAVAILABLE
`);
    const kernel = result.findings.find((finding) => finding.category === 'kernel');
    const display = result.findings.find((finding) => finding.category === 'display');
    const biometric = result.findings.find((finding) => finding.category === 'biometric');
    expect(kernel).toBeTruthy();
    expect(display).toBeTruthy();
    expect(biometric).toBeTruthy();
    expect(display?.relatedFindingIds).toContain(biometric?.id);
  });

  it('returns a clean result when no supported signature is present', () => {
    const result = analyze('09-24 12:00:00.000 ActivityManager: device is operating normally');
    expect(result.findings).toHaveLength(0);
  });
});
