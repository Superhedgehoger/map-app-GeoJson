import { describe, expect, it } from 'vitest';
import { createAppConfig, resolvePrivateApiUrl, resolveVariant } from '../../src/config';

describe('variant configuration', () => {
  it('lets the public query parameter override an explicit distribution default', () => {
    expect(resolveVariant({ search: '?variant=lite', explicitVariant: 'full' })).toBe('lite');
  });

  it('detects the legacy Lite entry path', () => {
    expect(resolveVariant({ pathname: '/Geomap-app-lite/' })).toBe('lite');
  });

  it('exposes a single capability contract', () => {
    expect(createAppConfig({ search: '?variant=lite' }).capabilities).toEqual({
      eventTracker: false,
      siteSelection: false,
      businessData: true,
      privateCollaboration: false,
      offlineEditing: true,
      fullMobileEditing: false
    });
  });

  it('only accepts credential-free HTTP(S) private API URLs', () => {
    expect(resolvePrivateApiUrl('https://maps.example.com/')).toBe('https://maps.example.com');
    expect(resolvePrivateApiUrl('https://user:pass@maps.example.com')).toBeNull();
    expect(resolvePrivateApiUrl('javascript:alert(1)')).toBeNull();
    expect(createAppConfig({ search: '?privateApi=http://127.0.0.1:8787' }).privateApiUrl).toBe(
      'http://127.0.0.1:8787'
    );
  });
});
