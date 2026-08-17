import type { AppConfig, GeomapVariant } from './types';

export interface ConfigInput {
  search?: string;
  pathname?: string;
  explicitVariant?: unknown;
  basePath?: string;
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
  return Object.freeze({
    variant,
    basePath: input.basePath ?? './',
    capabilities: Object.freeze({
      eventTracker: variant === 'full',
      siteSelection: variant === 'full',
      offlineEditing: true,
      fullMobileEditing: false
    })
  });
}
