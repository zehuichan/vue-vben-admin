import { eventHandler } from 'h3';
import { MOCK_TENANT_PACKAGES } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyPlatformAdmin } from '~/utils/tenant-utils';

/**
 * Packages for the tenant form. Disabled packages are returned as disabled
 * options so tenants that already use one still display it.
 */
export default eventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  return useResponseSuccess(
    MOCK_TENANT_PACKAGES.map((item) => ({
      disabled: item.status !== 1,
      label: item.name,
      value: item.id,
    })),
  );
});
