export interface GuidePage {
  slug: string;
  title: string;
  description: string;
  heading: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const guidePages: GuidePage[] = [
  {
    slug: 'how-to-capture-android-bugreport',
    title: 'How to Capture an Android Bugreport for Debugging',
    description: 'Practical guide to collecting Android bugreport data and preserving useful evidence for crash, reboot, ANR, and system debugging.',
    heading: 'How to Capture an Android Bugreport',
    summary: 'A useful bugreport must be collected close to the failure. Waiting too long can push important log buffers out of the capture.',
    sections: [
      { heading: 'Capture close to the incident', body: 'Reproduce the problem when safe, note the approximate time, and capture the bugreport as soon as practical. Exact timing makes event correlation much more reliable.' },
      { heading: 'Keep the original archive', body: 'Do not manually edit the source archive before analysis. Preserve the original file and make redacted copies only when sharing outside your organization.' },
      { heading: 'Add reproduction context', body: 'Record what the user was doing, whether the screen was on, whether charging or radio activity was involved, and whether the issue recovered without a full restart.' },
    ],
  },
  {
    slug: 'how-to-read-android-bugreport',
    title: 'How to Read an Android Bugreport Without Getting Lost',
    description: 'Learn a practical order for reading Android bugreports: establish time, device metadata, symptoms, subsystem evidence, and correlation.',
    heading: 'How to Read an Android Bugreport',
    summary: 'Do not start by grepping random error strings. Establish the incident time and failure class first, then narrow the subsystem.',
    sections: [
      { heading: 'Start with the incident', body: 'Define the symptom and approximate time. A bugreport contains many harmless warnings, so an error without temporal or subsystem context is weak evidence.' },
      { heading: 'Check device and build identity', body: 'Confirm Android version, build fingerprint, kernel version, and vendor build before comparing behavior with source or symbols.' },
      { heading: 'Build a timeline', body: 'Move backward from the visible failure to the earliest abnormal event. Later messages are often consequences rather than causes.' },
    ],
  },
  {
    slug: 'android-reboot-reason-debugging',
    title: 'Android Reboot Reason Debugging Guide',
    description: 'Understand how to use Android boot reason, watchdog, kernel, thermal, and framework evidence to investigate unexpected restarts.',
    heading: 'Debugging Android Reboot Reasons',
    summary: 'A boot reason string is useful, but it is not enough by itself. Vendor implementations vary, and the reason should be verified against surrounding evidence.',
    sections: [
      { heading: 'Treat boot reason as a clue', body: 'Use ro.boot.bootreason or vendor reboot-reason data to choose a direction, then validate that direction against kernel and userspace evidence.' },
      { heading: 'Separate orderly reboot from reset', body: 'Look for framework shutdown sequences. Their absence, combined with panic or watchdog evidence, changes the likely failure path.' },
      { heading: 'Correlate hardware-facing services', body: 'Display, biometric, modem, storage, and power services can appear shortly before a reset. Repeated timing relationships are stronger than isolated warnings.' },
    ],
  },
  {
    slug: 'android-anr-debugging',
    title: 'Android ANR Debugging Guide',
    description: 'A practical method for debugging Android ANRs using timeout type, process state, threads, binder, CPU, I/O, and system evidence.',
    heading: 'Android ANR Debugging',
    summary: 'The ANR line tells you that a deadline was missed. Root cause analysis begins by finding what prevented the target thread or component from completing on time.',
    sections: [
      { heading: 'Classify the timeout', body: 'Input dispatch, broadcast, service, and content-provider ANRs have different execution paths. Classify first before reading thread traces.' },
      { heading: 'Inspect blocking chains', body: 'Look for lock waits, binder calls, disk I/O, network waits, and CPU starvation on the critical execution path.' },
      { heading: 'Check system pressure', body: 'High CPU, memory pressure, storage stalls, or a failing system service can turn otherwise acceptable code into an ANR.' },
    ],
  },
  {
    slug: 'android-native-crash-tombstone',
    title: 'Android Native Crash and Tombstone Debugging Guide',
    description: 'Understand Android fatal signals, tombstones, abort messages, fault addresses, backtraces, and symbolization requirements.',
    heading: 'Android Native Crash and Tombstone Debugging',
    summary: 'Native crashes require exact build identity. Unsymbolized addresses from the wrong binary build can send an investigation in the wrong direction.',
    sections: [
      { heading: 'Read the signal and abort message', body: 'Start with the signal, fault address, process, thread, and abort message before interpreting a backtrace.' },
      { heading: 'Use matching symbols', body: 'Symbolize only with binaries and symbols from the exact build. Vendor and locally rebuilt libraries can shift addresses significantly.' },
      { heading: 'Find the first meaningful frame', body: 'Framework crash handlers and libc termination frames are often secondary. Focus on the first frame that belongs to the failing code path.' },
    ],
  },
  {
    slug: 'android-fingerprint-hal-debugging',
    title: 'Android Fingerprint HAL Debugging Guide',
    description: 'Debug Android fingerprint and UDFPS problems across framework, biometric service, HAL, vendor process, binder, and display layers.',
    heading: 'Android Fingerprint HAL Debugging',
    summary: 'Fingerprint is not a single service. Framework state, vendor HAL, binder lifecycle, sensor hardware, and UDFPS display coordination can all matter.',
    sections: [
      { heading: 'Check service lifecycle first', body: 'Look for biometric or fingerprint service death, binder death notifications, HAL restarts, and failure to reconnect.' },
      { heading: 'For UDFPS, inspect display coordination', body: 'Under-display sensors depend on display state and brightness/HBM behavior. Correlate authentication timestamps with SurfaceFlinger and composer events.' },
      { heading: 'Distinguish persistent from transient failure', body: 'A failure that recovers after framework restart is different from one that only recovers after full power cycling.' },
    ],
  },
  {
    slug: 'android-surfaceflinger-debugging',
    title: 'Android SurfaceFlinger and HWC Debugging Guide',
    description: 'Debug Android display freezes and black screens using SurfaceFlinger, hardware composer, DisplayManager, binder, and driver evidence.',
    heading: 'Android SurfaceFlinger and HWC Debugging',
    summary: 'A frozen display can originate in app rendering, SurfaceFlinger, hardware composer, vendor services, or the kernel driver. The timeline is the fastest way to separate them.',
    sections: [
      { heading: 'Separate rendering from composition', body: 'Application frame production and final hardware composition are different layers. Identify which layer stopped making progress.' },
      { heading: 'Watch for composer death', body: 'Vendor composer service death or repeated binder errors can leave SurfaceFlinger unable to present frames reliably.' },
      { heading: 'Correlate with watchdogs', body: 'If display services stop responding before a watchdog reboot, investigate whether the display failure is part of the reset chain rather than a visual side effect.' },
    ],
  },
  {
    slug: 'android-thermal-debugging',
    title: 'Android Thermal Shutdown and Throttling Debugging Guide',
    description: 'Investigate Android thermal shutdown and throttling using thermal zones, policy thresholds, workload correlation, and reboot evidence.',
    heading: 'Android Thermal Debugging',
    summary: 'Normal throttling is expected. The debugging question is whether thermal policy reached emergency levels or whether heat merely accompanied another failure.',
    sections: [
      { heading: 'Identify the thermal zone', body: 'CPU, battery, skin, modem, GPU, and PMIC sensors can have different policy thresholds and implications.' },
      { heading: 'Map temperature to workload', body: 'Correlate charging, radio activity, display brightness, CPU/GPU load, and ambient conditions with the thermal event.' },
      { heading: 'Confirm shutdown evidence', body: 'Do not infer thermal shutdown from high temperature alone. Look for explicit thermal emergency, power, or reboot indicators.' },
    ],
  },
];
