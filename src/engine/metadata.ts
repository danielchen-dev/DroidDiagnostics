import type { DeviceMetadata, DiagnosticSource } from './types';

const PROPERTY_PATTERNS: Array<[keyof DeviceMetadata, RegExp[]]> = [
  ['model', [/\[ro\.product\.model\]:\s*\[(.+?)\]/i, /ro\.product\.model[=:]\s*(.+)/i]],
  ['manufacturer', [/\[ro\.product\.manufacturer\]:\s*\[(.+?)\]/i, /ro\.product\.manufacturer[=:]\s*(.+)/i]],
  ['androidVersion', [/\[ro\.build\.version\.release\]:\s*\[(.+?)\]/i, /ro\.build\.version\.release[=:]\s*(.+)/i]],
  ['sdk', [/\[ro\.build\.version\.sdk\]:\s*\[(.+?)\]/i, /ro\.build\.version\.sdk[=:]\s*(.+)/i]],
  ['buildFingerprint', [/\[ro\.build\.fingerprint\]:\s*\[(.+?)\]/i, /ro\.build\.fingerprint[=:]\s*(.+)/i]],
  ['buildId', [/\[ro\.build\.id\]:\s*\[(.+?)\]/i, /ro\.build\.id[=:]\s*(.+)/i]],
  ['securityPatch', [/\[ro\.build\.version\.security_patch\]:\s*\[(.+?)\]/i, /ro\.build\.version\.security_patch[=:]\s*(.+)/i]],
  ['bootReason', [/\[ro\.boot\.bootreason\]:\s*\[(.+?)\]/i, /ro\.boot\.bootreason[=:]\s*(.+)/i, /sys\.boot\.reason[=:]\s*(.+)/i]],
];

export function parseMetadata(sources: DiagnosticSource[]): DeviceMetadata {
  const metadata: DeviceMetadata = {};
  const combined = sources.map((source) => source.text).join('\n');

  for (const [key, patterns] of PROPERTY_PATTERNS) {
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match?.[1]) {
        metadata[key] = match[1].trim().replace(/^\[|\]$/g, '');
        break;
      }
    }
  }

  const kernel = combined.match(/Linux version\s+([^\n]+)/i);
  if (kernel?.[1]) metadata.kernelVersion = kernel[1].trim().slice(0, 220);

  return metadata;
}
