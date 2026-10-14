import { eventHandler } from 'h3';
import { getTenantByCode } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  return useResponseSuccess(
    getTenantByCode(access.userinfo.tenantCode) ?? null,
  );
});
