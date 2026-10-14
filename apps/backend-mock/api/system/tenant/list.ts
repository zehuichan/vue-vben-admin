import { eventHandler, getQuery } from 'h3';
import { MOCK_TENANTS } from '~/utils/mock-data';
import { usePageResponseSuccess } from '~/utils/response';
import { toTenantListItem, verifyPlatformAdmin } from '~/utils/tenant-utils';

export default eventHandler((event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const {
    page = 1,
    pageSize = 20,
    name,
    code,
    status,
    startTime,
    endTime,
  } = getQuery(event);

  let listData = MOCK_TENANTS.map((tenant) => toTenantListItem(tenant));
  if (name) {
    const keyword = String(name).toLowerCase();
    listData = listData.filter((item) =>
      item.name.toLowerCase().includes(keyword),
    );
  }
  if (code) {
    const keyword = String(code).toLowerCase();
    listData = listData.filter((item) => item.code.includes(keyword));
  }
  if (['0', '1'].includes(status as string)) {
    listData = listData.filter((item) => item.status === Number(status));
  }
  if (startTime) {
    listData = listData.filter(
      (item) => item.createTime.slice(0, 10) >= String(startTime),
    );
  }
  if (endTime) {
    listData = listData.filter(
      (item) => item.createTime.slice(0, 10) <= String(endTime),
    );
  }

  return usePageResponseSuccess(page as string, pageSize as string, listData);
});
