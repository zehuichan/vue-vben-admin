import { defineEventHandler, getRouterParam } from 'h3';
import { MOCK_TENANTS } from '~/utils/mock-data';
import {
  badRequestResponse,
  notFoundResponse,
  useResponseSuccess,
} from '~/utils/response';
import { removeTenant } from '~/utils/tenant-scope';
import { getTenantProtection, verifyPlatformAdmin } from '~/utils/tenant-utils';

export default defineEventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const id = getRouterParam(event, 'id');
  const tenant = MOCK_TENANTS.find((item) => item.id === id);
  if (!tenant) {
    return notFoundResponse(event, 'Tenant not found.');
  }

  const protection = getTenantProtection(
    tenant.code,
    admin.userinfo.tenantCode,
  );
  if (protection) {
    return badRequestResponse(event, `${protection} cannot be deleted.`);
  }

  removeTenant(tenant.code);
  return useResponseSuccess(null);
});
