export interface TechnicalReference {
  title: string;
  organization: string;
  url: string;
  description: string;
  type: 'official' | 'open-source';
}

export const technicalReferences: TechnicalReference[] = [
  {
    title: 'Bugreport file format',
    organization: 'Android Open Source Project',
    url: 'https://android.googlesource.com/platform/frameworks/native/+/master/cmds/dumpstate/bugreport-format.md',
    description: 'Canonical description of flat and zipped Android bugreport formats, including version.txt, main-entry.txt and FS/ entries.',
    type: 'official',
  },
  {
    title: 'Android 16 dumpstate implementation',
    organization: 'Android Open Source Project',
    url: 'https://android.googlesource.com/platform/frameworks/native/+/android16-release/cmds/dumpstate/dumpstate.cpp',
    description: 'Source of the sections, commands, ANR/tombstone collection, pstore/kernel capture, PSI files and dumpsys services included in current bugreports.',
    type: 'official',
  },
  {
    title: 'dumpsys command reference',
    organization: 'Android Developers',
    url: 'https://developer.android.com/tools/dumpsys',
    description: 'Official reference for dumpsys and BatteryStats machine-readable checkin output.',
    type: 'official',
  },
  {
    title: 'Diagnose and fix ANRs',
    organization: 'Android Developers',
    url: 'https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs',
    description: 'Official ANR diagnosis guidance, including distinguishing app-local stalls from system pressure.',
    type: 'official',
  },
  {
    title: 'Diagnose native crashes',
    organization: 'Android Open Source Project',
    url: 'https://source.android.com/docs/core/tests/debug/native-crash',
    description: 'Signal, abort message, tombstone, memory map and symbolization guidance for native Android crashes.',
    type: 'official',
  },
  {
    title: 'Low memory killer daemon (lmkd)',
    organization: 'Android Open Source Project',
    url: 'https://source.android.com/docs/core/perf/lmkd',
    description: 'Background on PSI-based memory-pressure detection and userspace low-memory process killing.',
    type: 'official',
  },
  {
    title: 'Validate SELinux',
    organization: 'Android Open Source Project',
    url: 'https://source.android.com/docs/security/features/selinux/validate',
    description: 'How to interpret avc: denied entries using permissions, source/target contexts and object class.',
    type: 'official',
  },
  {
    title: 'Battery Historian',
    organization: 'Google',
    url: 'https://github.com/google/battery-historian',
    description: 'Archived Apache-2.0 open-source reference for BatteryStats history/checkin parsing, timelines, wake locks, jobs, sync and wake reasons.',
    type: 'open-source',
  },
  {
    title: 'ChkBugReport',
    organization: 'Sony Xperia Developers',
    url: 'https://github.com/sonyxperiadev/ChkBugReport',
    description: 'Archived bugreport-to-HTML project that demonstrates the long-standing value of section-oriented bugreport parsing and human-readable reports.',
    type: 'open-source',
  },
  {
    title: 'brp – Android Bugreport Parser',
    organization: 'reedhoop',
    url: 'https://github.com/reedhoop/bugreportParser',
    description: 'MIT-licensed Rust parser with layered container/section parsing, grammar-driven dumpsys extraction and bugreport diff workflows. Referenced as current ecosystem prior art; no code is copied.',
    type: 'open-source',
  },
  {
    title: 'BugreportAnalyzer',
    organization: 'NasdaqGodzilla',
    url: 'https://github.com/NasdaqGodzilla/BugreportAnalyzer',
    description: 'Small open-source battery-oriented bugreport analyzer covering wake locks, jobs, alarms, runtime and power-consumption summaries. Useful as prior art for threshold/report concepts.',
    type: 'open-source',
  },
];
