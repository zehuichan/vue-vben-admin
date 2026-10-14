import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { isTenantRecordAvailable, MOCK_TENANTS } from '~/utils/mock-data';
import {
  badRequestResponse,
  notFoundResponse,
  useResponseSuccess,
} from '~/utils/response';
import { isPlatformTenant, syncTenantMembers } from '~/utils/tenant-scope';
import {
  getTenantProtection,
  pickTenantPayload,
  toTenantListItem,
  validateTenantPackage,
  validateTenantPayload,
  verifyPlatformAdmin,
} from '~/utils/tenant-utils';

export default defineEventHandler(async (event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }
  const { userinfo } = admin;

  const id = getRouterParam(event, 'id');
  const tenant = MOCK_TENANTS.find((item) => item.id === id);
  if (!tenant) {
    return notFoundResponse(event, 'Tenant not found.');
  }

  // Tenant code is immutable: it is embedded in tokens, URLs and subdomains
  const { admins, members, ...fields } = pickTenantPayload(
    (await readBody(event)) ?? {},
  );
  const platform = isPlatformTenant(tenant.code);
  if (platform) {
    Reflect.deleteProperty(fields, 'packageId');
  }
  const payloadError =
    validateTenantPayload(fields) ??
    (!platform && fields.packageId !== undefined
      ? validateTenantPackage(fields.packageId, tenant.packageId)
      : null);
  if (payloadError) {
    return badRequestResponse(event, payloadError);
  }

  const protection = getTenantProtection(tenant.code, userinfo.tenantCode);
  if (protection && !isTenantRecordAvailable({ ...tenant, ...fields })) {
    return badRequestResponse(
      event,
      `${protection} cannot be disabled or expired.`,
    );
  }

  if (
    members &&
    tenant.code === userinfo.tenantCode &&
    !members.includes(userinfo.username)
  ) {
    return badRequestResponse(
      event,
      'You cannot remove yourself from the tenant you are signed in to.',
    );
  }

  const current = toTenantListItem(tenant);
  const nextMembers = members ?? current.members;
  const nextAdmins = platform
    ? undefined
    : (admins ?? current.admins.filter((name) => nextMembers.includes(name)));
  if (nextAdmins?.length === 0) {
    return badRequestResponse(
      event,
      'A tenant needs at least one administrator.',
    );
  }

  Object.assign(tenant, fields);
  if (members || admins) {
    syncTenantMembers(tenant.code, nextMembers, nextAdmins);
  }

  return useResponseSuccess(toTenantListItem(tenant));
});
