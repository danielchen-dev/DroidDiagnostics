export interface DiagnosticPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  symptoms: string[];
  detects: string[];
  checks: string[];
  category: string;
}

export const diagnosticPages: DiagnosticPage[] = [
  {
    slug: 'android-reboot-analyzer',
    title: 'Android Reboot Analyzer – Find Unexpected Restart Causes',
    description: 'Analyze Android bugreport files for watchdog resets, kernel panic, thermal shutdown, system_server failures, and boot reason evidence.',
    h1: 'Android Reboot Analyzer',
    intro: 'Unexpected Android restarts are often spread across framework, kernel, vendor, and boot logs. DroidDiagnostics brings the strongest restart evidence into one report.',
    symptoms: ['Random restart with no obvious crash dialog', 'Reboot after the screen freezes', 'Restart after a vendor or system service stops responding', 'Device returns with hardware features temporarily unavailable'],
    detects: ['Watchdog-triggered restarts', 'Boot reason records', 'Kernel panic indicators', 'Thermal shutdown evidence', 'Related display and biometric failures'],
    checks: ['Check the earliest critical event before the restart.', 'Compare boot reason strings with kernel and framework evidence.', 'Look for repeated subsystem failures across multiple incidents.'],
    category: 'reboot',
  },
  {
    slug: 'android-anr-analyzer',
    title: 'Android ANR Analyzer – Inspect App Not Responding Events',
    description: 'Find Android ANR, input dispatch timeout, broadcast timeout, and related system evidence in bugreport and log files.',
    h1: 'Android ANR Analyzer',
    intro: 'ANRs rarely make sense from the final timeout line alone. The useful evidence is the affected process, timeout type, and surrounding scheduler, binder, CPU, or I/O activity.',
    symptoms: ['App freezes before showing an ANR dialog', 'Input stops responding', 'Broadcast or service timeout', 'System app becomes unresponsive'],
    detects: ['ANR in process records', 'Input dispatch timeouts', 'Broadcast timeout evidence', 'Related kernel or display stalls'],
    checks: ['Inspect the affected main thread and binder threads.', 'Check for lock contention and binder exhaustion.', 'Correlate the ANR timestamp with CPU, storage, and system-service events.'],
    category: 'anr',
  },
  {
    slug: 'android-crash-analyzer',
    title: 'Android Crash Analyzer – Java and Native Crash Detection',
    description: 'Analyze Android logs for fatal exceptions, native fatal signals, tombstone evidence, and process crash context.',
    h1: 'Android Crash Analyzer',
    intro: 'DroidDiagnostics separates Java/Kotlin runtime failures from native process crashes and highlights evidence that matters for the next debugging step.',
    symptoms: ['App closes unexpectedly', 'System component keeps crashing', 'Native service dies', 'Fatal exception appears in logcat'],
    detects: ['FATAL EXCEPTION records', 'AndroidRuntime crashes', 'Native fatal signals', 'Tombstone-style evidence'],
    checks: ['Find the first app-owned frame for Java crashes.', 'Use exact matching symbols for native crashes.', 'Check whether a lower-level service failed before the visible app crash.'],
    category: 'crash',
  },
  {
    slug: 'android-kernel-panic-analyzer',
    title: 'Android Kernel Panic Analyzer – Detect Kernel Faults and Lockups',
    description: 'Find kernel panic, lockup, RCU stall, hung task, watchdog bite, and fatal kernel evidence in Android diagnostics.',
    h1: 'Android Kernel Panic Analyzer',
    intro: 'Kernel faults can cause abrupt resets without a normal Android crash trail. This analyzer isolates panic, lockup, and blocked-task evidence from the diagnostic set.',
    symptoms: ['Sudden reboot with little framework evidence', 'Device completely freezes', 'Watchdog reset under hardware load', 'Repeated driver-related instability'],
    detects: ['Kernel panic text', 'Soft and hard lockups', 'Hung tasks', 'RCU stalls', 'Watchdog bite evidence'],
    checks: ['Capture pstore or ramoops whenever possible.', 'Inspect the first kernel stack before secondary errors.', 'Match symbols and vendor modules to the exact build.'],
    category: 'kernel',
  },
  {
    slug: 'android-fingerprint-log-analyzer',
    title: 'Android Fingerprint Log Analyzer – Biometric and UDFPS Failures',
    description: 'Analyze Android bugreports for fingerprint HAL failures, biometric service errors, UDFPS issues, and post-reboot sensor problems.',
    h1: 'Android Fingerprint Log Analyzer',
    intro: 'Fingerprint failures can cross framework, HAL, vendor, and display layers. DroidDiagnostics groups those signals instead of treating each log line in isolation.',
    symptoms: ['Fingerprint stops working after a reboot', 'Biometric prompt reports hardware unavailable', 'UDFPS area does not light correctly', 'Fingerprint HAL or vendor service dies'],
    detects: ['Fingerprint and biometric errors', 'HAL/service death indicators', 'UDFPS-related failures', 'Related display pipeline errors'],
    checks: ['Check for HAL binder death and reconnection.', 'Correlate UDFPS failures with HBM/display events.', 'Verify whether the issue survives a framework or full device restart.'],
    category: 'biometric',
  },
  {
    slug: 'android-display-log-analyzer',
    title: 'Android Display Log Analyzer – SurfaceFlinger and HWC Errors',
    description: 'Find SurfaceFlinger, hardware composer, DisplayManager, DRM, and display HAL failures in Android diagnostics.',
    h1: 'Android Display Log Analyzer',
    intro: 'Display failures can cascade into frozen UI, black screens, watchdog resets, or biometric problems. This page focuses the analyzer on the display pipeline.',
    symptoms: ['Black or frozen screen', 'UI stops updating', 'Display recovers only after reboot', 'SurfaceFlinger or composer service failure'],
    detects: ['SurfaceFlinger errors', 'Hardware composer failures', 'DisplayManager errors', 'DRM/display HAL failures'],
    checks: ['Correlate framework and vendor composer timestamps.', 'Check for binder death or service restart.', 'Inspect kernel display driver errors when userspace evidence is incomplete.'],
    category: 'display',
  },
  {
    slug: 'android-thermal-log-analyzer',
    title: 'Android Thermal Analyzer – Shutdown and Throttling Evidence',
    description: 'Analyze Android logs for thermal shutdown, critical temperature, throttling, and heat-related stability problems.',
    h1: 'Android Thermal Analyzer',
    intro: 'Heat can cause expected throttling or emergency shutdown. The important distinction is whether thermal events merely coexist with a problem or directly explain it.',
    symptoms: ['Device powers off under load', 'Performance drops sharply while hot', 'Restart occurs during charging or GPU load', 'Thermal warnings appear before instability'],
    detects: ['Thermal shutdown markers', 'Critical temperature records', 'Thermal throttling activity', 'Related reboot evidence'],
    checks: ['Identify the sensor and thermal zone involved.', 'Compare the event with charging, radio, CPU, GPU, and display load.', 'Separate normal throttling from emergency thermal policy.'],
    category: 'thermal',
  },
  {
    slug: 'android-bootloop-analyzer',
    title: 'Android Bootloop Analyzer – Init, Zygote and Boot Failures',
    description: 'Inspect Android bugreports and boot logs for init failures, zygote crashes, repeated service crashes, and boot timeout evidence.',
    h1: 'Android Bootloop Analyzer',
    intro: 'A boot loop is usually a sequence, not one error. The analyzer surfaces the earliest init, zygote, service, and crash evidence that may explain why boot cannot stabilize.',
    symptoms: ['Logo repeats without reaching launcher', 'Boot completes only after several restarts', 'Critical service repeatedly crashes during startup', 'Zygote or init failure appears in logs'],
    detects: ['Init service failures', 'Zygote crash evidence', 'Repeated boot-service crashes', 'Related native or framework crash records'],
    checks: ['Find the first failing dependency rather than the last repeated error.', 'Inspect SELinux, filesystem, property, and vendor service initialization.', 'Compare a failed boot against a known-good boot when possible.'],
    category: 'boot',
  },
];
