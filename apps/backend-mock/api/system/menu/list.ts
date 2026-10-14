import { eventHandler } from 'h3';
import { useResponseSuccess } from '~/utils/response';
import { getTenantMenuCatalog } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

/**
 * Also feeds the role permission tree, so regular tenants only get the menus
 * their package grants.
 */
export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  return useResponseSuccess(getTenantMenuCatalog(access.userinfo.tenantCode));
});
