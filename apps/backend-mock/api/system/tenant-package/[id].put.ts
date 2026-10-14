import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { findTenantPackage, MOCK_TENANT_PACKAGES } from '~/utils/mock-data';
import {
  badRequestResponse,
  notFoundResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  pickTenantPackagePayload,
  toTenantPackageListItem,
  verifyPlatformAdmin,
} from '~/utils/tenant-utils';

/**
 * Menu changes apply to every tenant on the package at their next request;
 * disabling only prevents assigning the package to more tenants.
 */
export default defineEventHandler(async (event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const tenantPackage = findTenantPackage(getRouterParam(event, 'id') ?? '');
  if (!tenantPackage) {
    return notFoundResponse(event, 'Tenant package not found.');
  }

  const payload = pickTenantPackagePayload((await readBody(event)) ?? {});
  if (payload.name !== undefined && !payload.name) {
    return badRequestResponse(event, 'Package name is required.');
  }
  if (
    payload.name &&
    MOCK_TENANT_PACKAGES.some(
      (item) => item.name === payload.name && item.id !== tenantPackage.id,
    )
  ) {
    return badRequestResponse(
      event,
      `Package "${payload.name}" already exists.`,
    );
  }

  Object.assign(tenantPackage, payload);
  return useResponseSuccess(toTenantPackageListItem(tenantPackage));
});
