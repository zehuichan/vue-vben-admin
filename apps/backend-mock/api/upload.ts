import { eventHandler } from 'h3';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  return useResponseSuccess({
    url: 'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
  });
  // return useResponseError("test")
});
