import { eventHandler } from 'h3';
import { MOCK_USERS } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyPlatformAdmin } from '~/utils/tenant-utils';

/**
 * Login accounts that can be assigned to a tenant.
 */
export default eventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  return useResponseSuccess(
    MOCK_USERS.map((user) => ({
      label: `${user.realName} (${user.username})`,
      value: user.username,
    })),
  );
});
