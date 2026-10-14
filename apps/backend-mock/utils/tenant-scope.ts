import type { TenantMembership } from './mock-data';

import {
  DEFAULT_TENANT_CODE,
  findMembership,
  findTenantPackage,
  findTenantRecord,
  MOCK_MEMBERSHIPS,
  MOCK_MENU_LIST,
  MOCK_TENANTS,
  PLATFORM_ADMIN_ROLE,
  TENANT_ADMIN_ROLE,
  TENANT_USER_ROLE,
} from './mock-data';

interface MenuNode {
  [key: string]: any;
  children?: MenuNode[];
  id: number;
  name: string;
  path?: string;
  platformOnly?: boolean;
}

export interface TenantRoleRecord {
  code: string;
  createTime: string;
  id: string;
  name: string;
  permissions: number[];
  remark: string;
  status: 0 | 1;
}

const FALLBACK_HOME_PATH = '/dashboard/analytics';

/** Menus every member gets, regardless of role */
const MEMBER_MENU_IDS = [1, 101, 102, 3, 9, 901, 902, 10];

function flattenMenus(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children ?? [])]);
}

export function isPlatformTenant(tenantCode: string) {
  return tenantCode === DEFAULT_TENANT_CODE;
}

/** Menu ids a package may include: everything except platform-only menus */
export function getPackageableMenuIds(): Set<number> {
  return new Set(
    flattenMenus(MOCK_MENU_LIST as MenuNode[])
      .filter((node) => !node.platformOnly)
      .map((node) => node.id),
  );
}

/**
 * Menu catalog the tenant may use. The platform tenant gets everything; other
 * tenants get their package's menus (a parent stays while any child is
 * granted) and never get platform-only menus.
 */
export function getTenantMenuCatalog(tenantCode: string): MenuNode[] {
  if (isPlatformTenant(tenantCode)) {
    return structuredClone(MOCK_MENU_LIST) as MenuNode[];
  }
  const tenant = findTenantRecord(tenantCode);
  const allowed = new Set(findTenantPackage(tenant?.packageId ?? '')?.menuIds);

  const filterTree = (nodes: MenuNode[]): MenuNode[] =>
    nodes.flatMap((node) => {
      if (node.platformOnly) {
        return [];
      }
      const children = node.children ? filterTree(node.children) : undefined;
      if (!allowed.has(node.id) && !children?.length) {
        return [];
      }
      return [{ ...node, ...(node.children ? { children } : {}) }];
    });

  return filterTree(structuredClone(MOCK_MENU_LIST) as MenuNode[]);
}

/** Catalog route names the tenant may not use */
export function getTenantHiddenMenus(tenantCode: string): string[] {
  const visible = new Set(
    flattenMenus(getTenantMenuCatalog(tenantCode)).map((node) => node.name),
  );
  return flattenMenus(MOCK_MENU_LIST as MenuNode[])
    .map((node) => node.name)
    .filter((name) => !visible.has(name));
}

export function filterMenusByTenant(menus: any[], tenantCode: string): any[] {
  const hidden = new Set(getTenantHiddenMenus(tenantCode));
  if (hidden.size === 0) {
    return menus;
  }

  const filterTree = (items: any[]): any[] =>
    items
      .filter((item) => !hidden.has(item.name))
      .map((item) =>
        item.children?.length
          ? { ...item, children: filterTree(item.children) }
          : item,
      );

  return filterTree(menus);
}

/** Falls back to analytics when the user's home page is outside the package */
export function resolveHomePath(
  homePath: string | undefined,
  tenantCode: string,
) {
  const hidden = new Set(getTenantHiddenMenus(tenantCode));
  const hiddenPaths: string[] = [];
  const collect = (nodes: MenuNode[], parentPath: string) => {
    nodes.forEach((node) => {
      const path = node.path?.startsWith('/')
        ? node.path
        : `${parentPath}/${node.path ?? ''}`;
      if (hidden.has(node.name)) {
        hiddenPaths.push(path);
      }
      collect(node.children ?? [], path);
    });
  };
  collect(MOCK_MENU_LIST as MenuNode[], '');

  if (
    !homePath ||
    hiddenPaths.some(
      (path) => homePath === path || homePath.startsWith(`${path}/`),
    )
  ) {
    return FALLBACK_HOME_PATH;
  }
  return homePath;
}

/**
 * Set the tenant's members. For regular tenants `admins` decides who is a
 * tenant admin (everyone else is a plain member); the platform tenant keeps
 * existing roles and new members join as plain members.
 */
export function syncTenantMembers(
  tenantCode: string,
  usernames: string[],
  admins?: string[],
) {
  const keep = new Set([...usernames, ...(admins ?? [])]);
  for (let i = MOCK_MEMBERSHIPS.length - 1; i >= 0; i--) {
    const membership = MOCK_MEMBERSHIPS[i] as TenantMembership;
    if (
      membership.tenantCode === tenantCode &&
      !keep.has(membership.username)
    ) {
      MOCK_MEMBERSHIPS.splice(i, 1);
    }
  }

  keep.forEach((username) => {
    const existing = findMembership(username, tenantCode);
    if (admins && !isPlatformTenant(tenantCode)) {
      const roles = admins.includes(username)
        ? [TENANT_ADMIN_ROLE]
        : [TENANT_USER_ROLE];
      if (existing) {
        existing.roles = roles;
      } else {
        MOCK_MEMBERSHIPS.push({ roles, tenantCode, username });
      }
    } else if (!existing) {
      MOCK_MEMBERSHIPS.push({
        roles: [TENANT_USER_ROLE],
        tenantCode,
        username,
      });
    }
  });
}

export function removeTenant(code: string) {
  const index = MOCK_TENANTS.findIndex((item) => item.code === code);
  if (index !== -1) {
    MOCK_TENANTS.splice(index, 1);
  }
  syncTenantMembers(code, []);
}

/**
 * Roles defined inside a tenant. Permissions are re-intersected with the
 * tenant's catalog on every read so package changes apply immediately.
 */
export function getTenantRoles(tenantCode: string): TenantRoleRecord[] {
  const catalogIds = flattenMenus(getTenantMenuCatalog(tenantCode)).map(
    (node) => node.id,
  );
  const tenantAdminIds = flattenMenus(MOCK_MENU_LIST as MenuNode[])
    .filter((node) => !node.platformOnly)
    .map((node) => node.id);
  const createTime = findTenantRecord(tenantCode)?.createTime ?? '';

  const definitions: Array<Omit<TenantRoleRecord, 'createTime' | 'id'>> = [
    {
      code: TENANT_ADMIN_ROLE,
      name: 'Tenant Administrator',
      permissions: tenantAdminIds,
      remark: 'Manages users, roles and departments of this tenant',
      status: 1,
    },
    {
      code: TENANT_USER_ROLE,
      name: 'Member',
      permissions: MEMBER_MENU_IDS,
      remark: 'Regular member',
      status: 1,
    },
  ];
  if (isPlatformTenant(tenantCode)) {
    definitions.unshift({
      code: PLATFORM_ADMIN_ROLE,
      name: 'Platform Administrator',
      permissions: catalogIds,
      remark: 'Manages tenants and tenant packages',
      status: 1,
    });
  }

  const allowed = new Set(catalogIds);
  return definitions.map((role) => ({
    ...role,
    createTime,
    id: `${tenantCode}-${role.code}`,
    permissions: role.permissions.filter((id) => allowed.has(id)),
  }));
}

/** Seed for per-tenant generated demo data, so each tenant sees its own rows */
export function getTenantSeed(tenantCode: string) {
  let hash = 0;
  for (const char of tenantCode) {
    hash = Math.trunc(hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return Math.abs(hash);
}
