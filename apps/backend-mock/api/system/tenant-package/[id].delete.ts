import { defineEventHandler, getRouterParam } from 'h3';
import { MOCK_TENANT_PACKAGES, MOCK_TENANTS } from '~/utils/mock-data';
import {
  badRequestResponse,
  notFoundResponse,
  useResponseSuccess,
} from '~/utils/response';
import { verifyPlatformAdmin } from '~/utils/tenant-utils';

export default defineEventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const id = getRouterParam(event, 'id');
  const index = MOCK_TENANT_PACKAGES.findIndex((item) => item.id === id);
  if (index === -1) {
    return notFoundResponse(event, 'Tenant package not found.');
  }

  const used = MOCK_TENANTS.filter((tenant) => tenant.packageId === id);
  if (used.length > 0) {
    return badRequestResponse(
      event,
      `Package is used by ${used.map((tenant) => tenant.name).join(', ')}.`,
    );
  }

  MOCK_TENANT_PACKAGES.splice(index, 1);
  return useResponseSuccess(null);
});
