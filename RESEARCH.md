# DroidDiagnostics technical research baseline

DroidDiagnostics v0.2 is an original TypeScript implementation. The project uses public Android documentation and open-source projects as technical references for diagnostic structure and workflow. External parser source code is not copied into the engine.

## Primary sources

- Android Open Source Project — `dumpstate` bugreport file format
  - https://android.googlesource.com/platform/frameworks/native/+/master/cmds/dumpstate/bugreport-format.md
  - Used to model `version.txt`, `main-entry.txt`, the primary flat-text entry, `FS/` side files, ANR split behavior, tombstones, and versioned bugreport layouts.
- Android Open Source Project — current `dumpstate` implementation
  - https://android.googlesource.com/platform/frameworks/native/+/android16-release/cmds/dumpstate/dumpstate.cpp
  - Used to validate the presence and ordering of log buffers, ANRs, tombstones, kernel/pstore, PSI, dumpsys services, storage/network state and other report sections.
- Android Developers — dumpsys
  - https://developer.android.com/tools/dumpsys
  - Used for BatteryStats/dumpsys terminology and machine-readable checkin concepts.
- Android Developers — ANR diagnosis
  - https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs
- Android Open Source Project — native crash diagnosis
  - https://source.android.com/docs/core/tests/debug/native-crash
- Android Open Source Project — lmkd
  - https://source.android.com/docs/core/perf/lmkd
- Android Open Source Project — SELinux validation
  - https://source.android.com/docs/security/features/selinux/validate

## Open-source prior art

### Battery Historian

https://github.com/google/battery-historian

Battery Historian is archived/read-only, but remains useful prior art for timeline-oriented BatteryStats analysis, aggregation, wake-lock/job/sync interpretation and A/B comparison. DroidDiagnostics v0.2 does not embed or invoke Battery Historian. Its current battery analyzer is an original, intentionally narrow implementation; a structured BatteryStats history state machine is planned separately.

### ChkBugReport

https://github.com/sonyxperiadev/ChkBugReport

ChkBugReport is useful historical prior art for converting large Android bugreports into human-readable diagnostic views. DroidDiagnostics does not copy its parser implementation.

## Parser principles adopted from the research

1. Treat the ZIP as a container with multiple evidence sources, not as one log file.
2. Preserve source identity, line number and timestamp for every surfaced finding.
3. Prefer explicit signatures over generic `error`/`warning` counting.
4. Keep recovery mechanisms (watchdog, reboot, process restart) separate from likely upstream failures.
5. Use incident timing and cross-subsystem correlation before escalating severity.
6. Label evidence strength; do not present a numeric score as a probability of root cause.
7. Keep file analysis local in the browser and avoid diagnostic upload by default.

## Known limitations in v0.2

- BatteryStats history is not yet parsed into a full state-machine timeline.
- ANR files are detected and searched but are not yet normalized into a structured per-thread model.
- Tombstones are searched and contextualized but are not yet parsed into typed registers/frames/maps/BuildIds.
- Dumpstate section parsing handles common headers but not every vendor-specific nested format.
- Proto side files are intentionally not decoded in v0.2.
- The engine requires a real-device regression corpus before signatures should be treated as mature across Android/vendor versions.

### brp / bugreportParser

https://github.com/reedhoop/bugreportParser

A current MIT-licensed Rust project with layered parsing, grammar-driven dumpsys extraction and bugreport diff workflows. It is useful prior art for how far structured parsing can go beyond broad pattern matching. DroidDiagnostics does not copy its code; the project reinforces the planned direction toward typed service grammars and A/B comparison.

### BugreportAnalyzer

https://github.com/NasdaqGodzilla/BugreportAnalyzer

A smaller public analyzer focused on battery-oriented summaries such as wake locks, jobs, alarms and drain-rate style metrics. It is referenced for ecosystem awareness only.
