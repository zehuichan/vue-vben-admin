import type { PlaygroundPreferencesExtension, TenantMode } from '#/preferences';

import { getCustomPreferences } from '@vben/preferences';

export type TenantLockSource = 'path' | 'subdomain';

export interface ResolvedTenant {
  code: string;
  source: TenantLockSource;
}

/**
 * 不作为租户编码的子域名
 */
export const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'localhost',
  'www',
]);

const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;

let cachedResolvedTenant: null | ResolvedTenant | undefined;

function normalizeBase(base: string) {
  if (!base || base === '/') {
    return '/';
  }
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * 从域名解析租户编码，如 acme.localhost、acme.example.com
 */
export function resolveTenantFromHostname(hostname: string): null | string {
  const host = hostname.split(':')[0]?.toLowerCase() ?? '';
  if (!host || host === 'localhost' || IPV4_REGEX.test(host)) {
    return null;
  }

  const parts = host.split('.').filter(Boolean);
  // *.localhost 至少 2 段，其它域名至少 3 段
  const minParts = parts.at(-1) === 'localhost' ? 2 : 3;
  const code = parts[0];
  if (parts.length < minParts || !code || RESERVED_SUBDOMAINS.has(code)) {
    return null;
  }
  return code;
}

/**
 * 从路径前缀 /t/:tenant/ 解析租户编码
 */
export function resolveTenantFromPathname(
  pathname: string,
  base = '/',
): null | string {
  const normalizedBase = normalizeBase(base);
  let path = pathname || '/';

  if (normalizedBase !== '/' && path.startsWith(normalizedBase.slice(0, -1))) {
    path = path.slice(normalizedBase.length - 1) || '/';
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
  }

  const match = path.match(/^\/t\/([\w-]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function getTenantMode(): TenantMode {
  const { tenantMode } = getCustomPreferences<PlaygroundPreferencesExtension>();
  return tenantMode ?? 'auto';
}

/**
 * 按 tenantMode 从访问地址解析租户
 * 结果在模块内缓存，供路由 base 与初始化共用
 */
export function resolveTenantFromLocation(
  mode?: TenantMode,
  locationLike: Pick<Location, 'hostname' | 'pathname'> = window.location,
  viteBase = import.meta.env.VITE_BASE || '/',
): null | ResolvedTenant {
  if (cachedResolvedTenant !== undefined) {
    return cachedResolvedTenant;
  }

  const tenantMode = mode ?? getTenantMode();
  cachedResolvedTenant = null;

  if (tenantMode === 'auto' || tenantMode === 'subdomain') {
    const code = resolveTenantFromHostname(locationLike.hostname);
    if (code) {
      cachedResolvedTenant = { code, source: 'subdomain' };
      return cachedResolvedTenant;
    }
  }

  if (tenantMode === 'auto' || tenantMode === 'path') {
    const code = resolveTenantFromPathname(locationLike.pathname, viteBase);
    if (code) {
      cachedResolvedTenant = { code, source: 'path' };
    }
  }

  return cachedResolvedTenant;
}

/**
 * 清除解析缓存（单元测试使用）
 */
export function clearResolvedTenantCache() {
  cachedResolvedTenant = undefined;
}

/**
 * 路由 base，路径前缀锁定租户时为 /t/:code/
 */
export function getTenantRouterBase(
  viteBase = import.meta.env.VITE_BASE || '/',
) {
  const normalizedBase = normalizeBase(viteBase);
  const resolved = resolveTenantFromLocation(
    undefined,
    window.location,
    viteBase,
  );

  if (resolved?.source === 'path') {
    return `${normalizedBase}t/${resolved.code}/`;
  }
  return normalizedBase;
}

/**
 * 移除指定名称的路由（含其子路由），用于按租户套餐裁剪前端路由
 */
export function filterRoutesByName<
  T extends { children?: T[]; name?: unknown },
>(routes: T[], hiddenNames: string[]): T[] {
  if (hiddenNames.length === 0) {
    return routes;
  }
  const hidden = new Set(hiddenNames);
  return routes
    .filter((route) => !hidden.has(String(route.name)))
    .map((route) =>
      route.children?.length
        ? {
            ...route,
            children: filterRoutesByName(route.children, hiddenNames),
          }
        : route,
    );
}

/**
 * 生成目标租户的访问地址（子域名 / 路径前缀）
 */
export function buildTenantUrl(
  code: string,
  source: TenantLockSource,
  locationLike: Pick<
    Location,
    'hostname' | 'origin' | 'port' | 'protocol'
  > = window.location,
  viteBase = import.meta.env.VITE_BASE || '/',
) {
  const normalizedBase = normalizeBase(viteBase);

  if (source === 'path') {
    return `${locationLike.origin}${normalizedBase}t/${code}/`;
  }

  const { hostname, port, protocol } = locationLike;
  const parts = hostname.split('.');
  let host: string;
  if (
    hostname === 'localhost' ||
    IPV4_REGEX.test(hostname) ||
    parts.at(-1) === 'localhost'
  ) {
    host = `${code}.localhost`;
  } else if (parts.length >= 3) {
    host = [code, ...parts.slice(1)].join('.');
  } else {
    host = `${code}.${hostname}`;
  }

  return `${protocol}//${host}${port ? `:${port}` : ''}${normalizedBase}`;
}
