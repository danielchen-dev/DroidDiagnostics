import { describe, expect, it } from 'vitest';
import { analyzeDiagnostics } from '../engine';
import { buildReportInventory } from '../sections';
import type { DiagnosticSource } from '../types';

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
    expect(result.version).toBe('0.2.0');
    expect(result.metadata.model).toBe('H300');
    expect(result.metadata.androidVersion).toBe('16');
    expect(result.findings.some((finding) => finding.category === 'reboot' && finding.severity === 'critical')).toBe(true);
    expect(result.findings.every((finding) => ['strong', 'moderate', 'weak'].includes(finding.evidenceStrength))).toBe(true);
  });

  it('detects ANR and Java crash evidence', () => {
    const result = analyze(`
09-24 11:00:00.001  1000  1000 E ActivityManager: ANR in com.example.app
09-24 11:00:00.002  1000  1000 E ActivityManager: Reason: Input dispatching timed out
09-24 11:00:00.101  2000  2000 E AndroidRuntime: FATAL EXCEPTION: main
09-24 11:00:00.102  2000  2000 E AndroidRuntime: Process: com.example.app, PID: 2000
09-24 11:00:00.103  2000  2000 E AndroidRuntime: java.lang.IllegalStateException: test
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

  it('detects memory, binder, storage and SELinux evidence independently', () => {
    const result = analyze(`
09-24 13:00:00.001 lmkd: Killing 'com.example.heavy' (3210), uid 10234, to free 248000kB; oom_adj 900
09-24 13:00:01.001 Binder: FAILED BINDER TRANSACTION (data size = 1048576)
09-24 13:00:02.001 kernel: I/O error, dev sda, sector 123456 op 0x0
09-24 13:00:03.001 audit: avc: denied { open } for pid=1000 comm="vendor.service" path="/dev/example" scontext=u:r:vendor_service:s0 tcontext=u:object_r:device:s0 tclass=chr_file permissive=0
`);
    expect(result.findings.some((finding) => finding.category === 'memory')).toBe(true);
    expect(result.findings.some((finding) => finding.category === 'binder')).toBe(true);
    expect(result.findings.some((finding) => finding.category === 'storage')).toBe(true);
    expect(result.findings.some((finding) => finding.category === 'selinux')).toBe(true);
  });

  it('detects long partial wake-lock evidence without calling it root cause', () => {
    const result = analyze(`
------ DUMPSYS BATTERYSTATS ------
Wake lock ExampleWakeLock: 12m 4s 210ms partial (3 times) realtime
`);
    const finding = result.findings.find((item) => item.category === 'battery');
    expect(finding).toBeTruthy();
    expect(finding?.title).toContain('wake lock');
    expect(finding?.summary.toLowerCase()).toContain('screen-off');
  });

  it('indexes bugreport metadata, side artifacts and dumpstate section capabilities', () => {
    const sources: DiagnosticSource[] = [
      { name: 'version.txt', text: '3.0', truncated: false, kind: 'metadata' },
      { name: 'main-entry.txt', text: 'bugreport-TEST.txt', truncated: false, kind: 'metadata' },
      {
        name: 'bugreport-TEST.txt',
        text: [
          '------ SYSTEM LOG (logcat -v threadtime -d *:v) ------',
          '09-24 10:00:00.000 ActivityManager: boot',
          '------ LAST KMSG (/sys/fs/pstore/console-ramoops) ------',
          'Kernel panic - not syncing',
          '------ DUMPSYS BATTERYSTATS ------',
          'Wake lock Test: 1m partial',
          '------ PSI MEMORY (/proc/pressure/memory) ------',
          'some avg10=0.00',
        ].join('\n'),
        truncated: false,
        kind: 'bugreport',
      },
      { name: 'FS/data/anr/anr_2026-09-24', text: '----- pid 1000 at 2026-09-24 -----', truncated: false, kind: 'anr' },
      { name: 'FS/data/tombstones/tombstone_00', text: '*** *** ***', truncated: false, kind: 'tombstone' },
    ];
    const inventory = buildReportInventory(sources);
    expect(inventory.bugreportFormat).toBe('3.0');
    expect(inventory.mainEntry).toBe('bugreport-TEST.txt');
    expect(inventory.sourceKinds.anr).toBe(1);
    expect(inventory.sourceKinds.tombstone).toBe(1);
    expect(inventory.sections.length).toBeGreaterThanOrEqual(4);
    expect(inventory.detectedCapabilities).toContain('Logcat buffers');
    expect(inventory.detectedCapabilities).toContain('Kernel / pstore');
    expect(inventory.detectedCapabilities).toContain('BatteryStats / power');
    expect(inventory.detectedCapabilities).toContain('Memory / PSI');
    expect(inventory.detectedCapabilities).toContain('Historical ANRs');
    expect(inventory.detectedCapabilities).toContain('Native tombstones');
  });

  it('returns a clean result when no supported signature is present', () => {
    const result = analyze('09-24 12:00:00.000 ActivityManager: device is operating normally');
    expect(result.findings).toHaveLength(0);
  });
});
