import type { DeviceMetadata, DiagnosticSource } from './types';

function findValue(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return undefined;
}

export function parseMetadata(sources: DiagnosticSource[]): DeviceMetadata {
  const text = sources.map((source) => source.text).join('\n');
  return {
    model: findValue(text, [
      /\[ro\.product\.model\]:\s*\[([^\]]+)\]/,
      /ro\.product\.model[=:]\s*([^\r\n]+)/,
      /Build model:\s*([^\r\n]+)/i,
    ]),
    manufacturer: findValue(text, [
      /\[ro\.product\.manufacturer\]:\s*\[([^\]]+)\]/,
      /ro\.product\.manufacturer[=:]\s*([^\r\n]+)/,
    ]),
    product: findValue(text, [
      /\[ro\.build\.product\]:\s*\[([^\]]+)\]/,
      /\[ro\.product\.name\]:\s*\[([^\]]+)\]/,
    ]),
    device: findValue(text, [
      /\[ro\.product\.device\]:\s*\[([^\]]+)\]/,
      /ro\.product\.device[=:]\s*([^\r\n]+)/,
    ]),
    androidVersion: findValue(text, [
      /\[ro\.build\.version\.release\]:\s*\[([^\]]+)\]/,
      /ro\.build\.version\.release[=:]\s*([^\r\n]+)/,
      /Android version:\s*([^\r\n]+)/i,
    ]),
    sdk: findValue(text, [
      /\[ro\.build\.version\.sdk\]:\s*\[([^\]]+)\]/,
      /ro\.build\.version\.sdk[=:]\s*(\d+)/,
      /SDK version:\s*(\d+)/i,
    ]),
    buildFingerprint: findValue(text, [
      /\[ro\.build\.fingerprint\]:\s*\[([^\]]+)\]/,
      /Build fingerprint:\s*['"]?([^'"\r\n]+)/i,
    ]),
    buildId: findValue(text, [
      /\[ro\.build\.id\]:\s*\[([^\]]+)\]/,
      /ro\.build\.id[=:]\s*([^\r\n]+)/,
    ]),
    buildType: findValue(text, [
      /\[ro\.build\.type\]:\s*\[([^\]]+)\]/,
      /ro\.build\.type[=:]\s*([^\r\n]+)/,
    ]),
    securityPatch: findValue(text, [
      /\[ro\.build\.version\.security_patch\]:\s*\[([^\]]+)\]/,
      /ro\.build\.version\.security_patch[=:]\s*([^\r\n]+)/,
    ]),
    kernelVersion: findValue(text, [
      /Kernel version:\s*([^\r\n]+)/i,
      /Linux version\s+([^\r\n]+)/,
    ]),
    bootReason: findValue(text, [
      /\[ro\.boot\.bootreason\]:\s*\[([^\]]+)\]/,
      /\[sys\.boot\.reason\]:\s*\[([^\]]+)\]/,
      /(?:boot|reboot)[ _-]?reason\s*[:=]\s*([^\r\n]+)/i,
    ]),
    uptime: findValue(text, [
      /------ UPTIME[^\n]*------\s*\n\s*([^\r\n]+)/i,
      /up time:\s*([^\r\n]+)/i,
    ]),
  };
}
