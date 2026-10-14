import { eventHandler } from 'h3';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';
import { getTimezone } from '~/utils/timezone-utils';

export default eventHandler((event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  return useResponseSuccess(getTimezone());
});
