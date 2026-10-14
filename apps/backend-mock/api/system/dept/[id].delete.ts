import { eventHandler } from 'h3';
import { sleep, useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  await sleep(1000);
  return useResponseSuccess(null);
});
