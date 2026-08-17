import { describe, expect, it } from 'vitest';
import { createAppConfig, resolveVariant } from '../../src/config';

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
      offlineEditing: true,
      fullMobileEditing: false
    });
  });
});
