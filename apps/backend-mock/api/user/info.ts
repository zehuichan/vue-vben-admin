import { eventHandler } from 'h3';
import { getUserTenants } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { getTenantHiddenMenus, resolveHomePath } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  const { userinfo } = access;
  return useResponseSuccess({
    ...userinfo,
    /** Route names outside the tenant package, for frontend access mode */
    hiddenMenus: getTenantHiddenMenus(userinfo.tenantCode),
    homePath: resolveHomePath(userinfo.homePath, userinfo.tenantCode),
    tenants: getUserTenants(userinfo.username),
  });
});
