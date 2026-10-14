import { eventHandler } from 'h3';
import { getRoleMenus } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { filterMenusByTenant } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  const { userinfo } = access;
  return useResponseSuccess(
    filterMenusByTenant(getRoleMenus(userinfo.roles), userinfo.tenantCode),
  );
});
