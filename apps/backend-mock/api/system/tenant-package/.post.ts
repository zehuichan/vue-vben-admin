import { defineEventHandler, readBody } from 'h3';
import { formatDateTime, MOCK_TENANT_PACKAGES } from '~/utils/mock-data';
import { badRequestResponse, useResponseSuccess } from '~/utils/response';
import {
  pickTenantPackagePayload,
  toTenantPackageListItem,
  verifyPlatformAdmin,
} from '~/utils/tenant-utils';

export default defineEventHandler(async (event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const payload = pickTenantPackagePayload((await readBody(event)) ?? {});
  if (!payload.name) {
    return badRequestResponse(event, 'Package name is required.');
  }
  if (MOCK_TENANT_PACKAGES.some((item) => item.name === payload.name)) {
    return badRequestResponse(
      event,
      `Package "${payload.name}" already exists.`,
    );
  }

  const tenantPackage = {
    createTime: formatDateTime(new Date()),
    id: String(
      Math.max(0, ...MOCK_TENANT_PACKAGES.map((item) => Number(item.id))) + 1,
    ),
    menuIds: payload.menuIds ?? [],
    name: payload.name,
    remark: payload.remark ?? '',
    status: payload.status ?? 1,
  };
  MOCK_TENANT_PACKAGES.push(tenantPackage);

  return useResponseSuccess(toTenantPackageListItem(tenantPackage));
});
