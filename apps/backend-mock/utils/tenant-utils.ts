import type { EventHandlerRequest, H3Event } from 'h3';

import type { TokenUserInfo } from './jwt-utils';
import type { TenantPackageRecord, TenantRecord } from './mock-data';

import { getTenantContext } from './jwt-utils';
import {
  DEFAULT_TENANT_CODE,
  findTenantPackage,
  getTenantMemberships,
  isTenantExpired,
  isTenantRecordAvailable,
  MOCK_TENANTS,
  MOCK_USERS,
  PLATFORM_ADMIN_ROLE,
  RESERVED_TENANT_CODES,
  TENANT_ADMIN_ROLE,
  TENANT_CODE_PATTERN,
} from './mock-data';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
} from './response';
import { getPackageableMenuIds, isPlatformTenant } from './tenant-scope';

export type TenantPackagePayload = Partial<
  Pick<TenantPackageRecord, 'menuIds' | 'name' | 'remark' | 'status'>
>;

type ErrorBody = ReturnType<typeof useResponseError>;

export type TenantAccessResult =
  | { response: ErrorBody; userinfo: null }
  | { response: null; userinfo: TokenUserInfo };

export type TenantPayload = Partial<
  Pick<
    TenantRecord,
    | 'contactName'
    | 'contactPhone'
    | 'expireTime'
    | 'logo'
    | 'name'
    | 'packageId'
    | 'remark'
    | 'status'
  >
> & { admins?: string[]; members?: string[] };

const TEXT_FIELDS = [
  'contactName',
  'contactPhone',
  'expireTime',
  'logo',
  'name',
  'packageId',
  'remark',
] as const;

/**
 * Verify the access token and that it matches an available tenant the user
 * still belongs to. A token whose tenant was disabled, expired or left after
 * issuing is treated as an expired session so the client signs in again.
 */
export function verifyTenantAccess(
  event: H3Event<EventHandlerRequest>,
): TenantAccessResult {
  const context = getTenantContext(event);
  if (context.error === 'mismatch') {
    return {
      response: forbiddenResponse(event, 'Tenant mismatch'),
      userinfo: null,
    };
  }
  if (context.error) {
    return { response: unAuthorizedResponse(event), userinfo: null };
  }
  return { response: null, userinfo: context.userinfo };
}

/**
 * Tenant and package management are platform capabilities: the caller must
 * hold the platform admin role and be signed in to the platform tenant.
 */
export function verifyPlatformAdmin(
  event: H3Event<EventHandlerRequest>,
): TenantAccessResult {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access;
  }
  const { userinfo } = access;
  if (
    !isPlatformTenant(userinfo.tenantCode) ||
    !userinfo.roles.includes(PLATFORM_ADMIN_ROLE)
  ) {
    return {
      response: forbiddenResponse(
        event,
        'Only platform administrators in the platform tenant can manage tenants.',
      ),
      userinfo: null,
    };
  }
  return access;
}

function pickUsernames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((username: unknown) =>
    MOCK_USERS.some((user) => user.username === username),
  );
}

/** Keep only known fields; absent fields stay undefined (partial update). */
export function pickTenantPayload(body: Record<string, any>): TenantPayload {
  const payload: TenantPayload = {};
  TEXT_FIELDS.forEach((key) => {
    if (body?.[key] !== undefined) {
      payload[key] = String(body[key] ?? '').trim();
    }
  });
  if (body?.status !== undefined) {
    payload.status = Number(body.status) === 0 ? 0 : 1;
  }
  payload.members = pickUsernames(body?.members);
  payload.admins = pickUsernames(body?.admins);
  return payload;
}

export function validateTenantCode(code: string): null | string {
  if (!TENANT_CODE_PATTERN.test(code)) {
    return 'Tenant code must be 2-32 lowercase letters, digits or hyphens, starting with a letter.';
  }
  if (RESERVED_TENANT_CODES.includes(code)) {
    return `Tenant code "${code}" is reserved.`;
  }
  return null;
}

export function validateTenantPayload(payload: TenantPayload): null | string {
  if (payload.name !== undefined && !payload.name) {
    return 'Tenant name is required.';
  }
  if (payload.expireTime && !/^\d{4}-\d{2}-\d{2}$/.test(payload.expireTime)) {
    return 'Expire time must be formatted as YYYY-MM-DD.';
  }
  return null;
}

/**
 * Regular tenants need an enabled package. Keeping a disabled package that is
 * already assigned is allowed, so disabling a package never breaks tenants.
 */
export function validateTenantPackage(
  packageId: string | undefined,
  currentPackageId?: string,
): null | string {
  if (!packageId) {
    return 'Tenant package is required.';
  }
  const tenantPackage = findTenantPackage(packageId);
  if (!tenantPackage) {
    return 'Tenant package not found.';
  }
  if (tenantPackage.status !== 1 && packageId !== currentPackageId) {
    return `Tenant package "${tenantPackage.name}" is disabled.`;
  }
  return null;
}

/**
 * Returns a label when the tenant must stay usable (platform tenant or the
 * caller's current tenant), otherwise null.
 */
export function getTenantProtection(
  code: string,
  currentTenantCode: string,
): null | string {
  if (code === DEFAULT_TENANT_CODE) {
    return 'The built-in platform tenant';
  }
  if (code === currentTenantCode) {
    return 'The tenant you are signed in to';
  }
  return null;
}

export function pickTenantPackagePayload(
  body: Record<string, any>,
): TenantPackagePayload {
  const payload: TenantPackagePayload = {};
  if (body?.name !== undefined) {
    payload.name = String(body.name ?? '').trim();
  }
  if (body?.remark !== undefined) {
    payload.remark = String(body.remark ?? '').trim();
  }
  if (body?.status !== undefined) {
    payload.status = Number(body.status) === 0 ? 0 : 1;
  }
  if (Array.isArray(body?.menuIds)) {
    const packageable = getPackageableMenuIds();
    payload.menuIds = [
      ...new Set(
        body.menuIds.map(Number).filter((id: number) => packageable.has(id)),
      ),
    ] as number[];
  }
  return payload;
}

export function toTenantPackageListItem(tenantPackage: TenantPackageRecord) {
  return {
    ...tenantPackage,
    tenantCount: MOCK_TENANTS.filter(
      (tenant) => tenant.packageId === tenantPackage.id,
    ).length,
  };
}

export function toTenantListItem(tenant: TenantRecord) {
  const memberships = getTenantMemberships(tenant.code);
  return {
    ...tenant,
    admins: memberships
      .filter((item) => item.roles.includes(TENANT_ADMIN_ROLE))
      .map((item) => item.username),
    available: isTenantRecordAvailable(tenant),
    expired: isTenantExpired(tenant),
    members: memberships.map((item) => item.username),
    packageName: findTenantPackage(tenant.packageId)?.name ?? '',
  };
}
