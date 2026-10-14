import { eventHandler } from 'h3';
import { getAccessCodes } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  return useResponseSuccess(getAccessCodes(access.userinfo.roles));
});
