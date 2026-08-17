import type { AppConfig, GeomapVariant } from './types';

export interface ConfigInput {
  search?: string;
  pathname?: string;
  explicitVariant?: unknown;
  basePath?: string;
  privateApiUrl?: unknown;
}

export function resolvePrivateApiUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveVariant(input: ConfigInput = {}): GeomapVariant {
  const search = input.search ?? globalThis.location?.search ?? '';
  const pathname = input.pathname ?? globalThis.location?.pathname ?? '';
  const query = new URLSearchParams(search).get('variant');
  const explicit = input.explicitVariant;
  const requested =
    query ??
    (explicit === 'full' || explicit === 'lite' ? explicit : undefined) ??
    (pathname.toLowerCase().includes('geomap-app-lite') ? 'lite' : 'full');
  return requested === 'lite' ? 'lite' : 'full';
}

export function createAppConfig(input: ConfigInput = {}): AppConfig {
  const variant = resolveVariant(input);
  const search = input.search ?? globalThis.location?.search ?? '';
  const privateApiUrl = resolvePrivateApiUrl(
    new URLSearchParams(search).get('privateApi') ?? input.privateApiUrl
  );
  return Object.freeze({
    variant,
    basePath: input.basePath ?? './',
    privateApiUrl,
    capabilities: Object.freeze({
      eventTracker: variant === 'full',
      siteSelection: variant === 'full',
      businessData: true,
      privateCollaboration: variant === 'full',
      offlineEditing: true,
      fullMobileEditing: false
    })
  });
}
