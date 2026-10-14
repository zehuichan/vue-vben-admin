import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildTenantUrl,
  clearResolvedTenantCache,
  getTenantRouterBase,
  resolveTenantFromHostname,
  resolveTenantFromLocation,
  resolveTenantFromPathname,
} from '../../src/utils/tenant';

vi.mock('@vben/preferences', () => ({
  getCustomPreferences: () => ({ tenantMode: 'auto' }),
}));

describe('resolveTenantFromHostname', () => {
  it('resolves *.localhost', () => {
    expect(resolveTenantFromHostname('acme.localhost')).toBe('acme');
    expect(resolveTenantFromHostname('acme.localhost:5555')).toBe('acme');
  });

  it('resolves subdomain of normal domain', () => {
    expect(resolveTenantFromHostname('acme.example.com')).toBe('acme');
  });

  it('ignores bare localhost, www, and IPs', () => {
    expect(resolveTenantFromHostname('localhost')).toBeNull();
    expect(resolveTenantFromHostname('www.example.com')).toBeNull();
    expect(resolveTenantFromHostname('127.0.0.1')).toBeNull();
    expect(resolveTenantFromHostname('example.com')).toBeNull();
  });
});

describe('resolveTenantFromPathname', () => {
  it('resolves /t/:tenant/ prefix', () => {
    expect(resolveTenantFromPathname('/t/acme/')).toBe('acme');
    expect(resolveTenantFromPathname('/t/acme/dashboard')).toBe('acme');
    expect(resolveTenantFromPathname('/t/nova')).toBe('nova');
  });

  it('respects vite base', () => {
    expect(resolveTenantFromPathname('/app/t/acme/', '/app/')).toBe('acme');
  });

  it('returns null for non-matching paths', () => {
    expect(resolveTenantFromPathname('/dashboard')).toBeNull();
    expect(resolveTenantFromPathname('/tenant/acme')).toBeNull();
  });
});

describe('resolveTenantFromLocation', () => {
  afterEach(() => {
    clearResolvedTenantCache();
  });

  it('prefers subdomain over path in auto mode', () => {
    const result = resolveTenantFromLocation('auto', {
      hostname: 'acme.localhost',
      pathname: '/t/nova/',
    });
    expect(result).toEqual({ code: 'acme', source: 'subdomain' });
  });

  it('uses path when subdomain is absent', () => {
    const result = resolveTenantFromLocation(
      'auto',
      { hostname: 'localhost', pathname: '/t/acme/auth/login' },
      '/',
    );
    expect(result).toEqual({ code: 'acme', source: 'path' });
  });

  it('returns null for select/single', () => {
    expect(
      resolveTenantFromLocation('select', {
        hostname: 'acme.localhost',
        pathname: '/t/acme/',
      }),
    ).toBeNull();
    clearResolvedTenantCache();
    expect(
      resolveTenantFromLocation('single', {
        hostname: 'acme.localhost',
        pathname: '/t/acme/',
      }),
    ).toBeNull();
  });
});

describe('getTenantRouterBase', () => {
  afterEach(() => {
    clearResolvedTenantCache();
  });

  it('returns /t/:code/ when path-locked', () => {
    // getTenantRouterBase reads the cached result instead of window.location
    resolveTenantFromLocation(
      'path',
      { hostname: 'localhost', pathname: '/t/acme/dashboard' },
      '/',
    );
    expect(getTenantRouterBase('/')).toBe('/t/acme/');
  });
});

describe('buildTenantUrl', () => {
  const locationLike = {
    hostname: 'localhost',
    origin: 'http://localhost:5555',
    port: '5555',
    protocol: 'http:',
  };

  it('builds path-based tenant URL', () => {
    expect(buildTenantUrl('acme', 'path', locationLike, '/')).toBe(
      'http://localhost:5555/t/acme/',
    );
  });

  it('builds subdomain-based tenant URL from localhost', () => {
    expect(buildTenantUrl('acme', 'subdomain', locationLike, '/')).toBe(
      'http://acme.localhost:5555/',
    );
  });
});
