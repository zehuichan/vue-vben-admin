import { eventHandler, getQuery } from 'h3';
import { MOCK_TENANT_PACKAGES } from '~/utils/mock-data';
import { usePageResponseSuccess } from '~/utils/response';
import {
  toTenantPackageListItem,
  verifyPlatformAdmin,
} from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const { page = 1, pageSize = 20, name, status } = getQuery(event);
  let listData = MOCK_TENANT_PACKAGES.map((item) =>
    toTenantPackageListItem(item),
  );
  if (name) {
    const keyword = String(name).toLowerCase();
    listData = listData.filter((item) =>
      item.name.toLowerCase().includes(keyword),
    );
  }
  if (['0', '1'].includes(status as string)) {
    listData = listData.filter((item) => item.status === Number(status));
  }

  return usePageResponseSuccess(page as string, pageSize as string, listData);
});
