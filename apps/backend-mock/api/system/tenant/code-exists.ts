import { eventHandler, getQuery } from 'h3';
import { findTenantRecord } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyPlatformAdmin } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const { code, id } = getQuery(event);
  const tenant = findTenantRecord(String(code ?? ''));
  return useResponseSuccess(!!tenant && (!id || tenant.id !== String(id)));
});
