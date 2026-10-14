import { eventHandler, getQuery } from 'h3';
import { usePageResponseSuccess } from '~/utils/response';
import { getTenantRoles } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  const {
    page = 1,
    pageSize = 20,
    name,
    id,
    remark,
    startTime,
    endTime,
    status,
  } = getQuery(event);
  let listData = getTenantRoles(access.userinfo.tenantCode);
  if (name) {
    listData = listData.filter((item) =>
      item.name.toLowerCase().includes(String(name).toLowerCase()),
    );
  }
  if (id) {
    listData = listData.filter((item) =>
      item.id.toLowerCase().includes(String(id).toLowerCase()),
    );
  }
  if (remark) {
    listData = listData.filter((item) =>
      item.remark.toLowerCase().includes(String(remark).toLowerCase()),
    );
  }
  if (startTime) {
    listData = listData.filter((item) => item.createTime >= String(startTime));
  }
  if (endTime) {
    listData = listData.filter((item) => item.createTime <= String(endTime));
  }
  if (['0', '1'].includes(status as string)) {
    listData = listData.filter((item) => item.status === Number(status));
  }
  return usePageResponseSuccess(page as string, pageSize as string, listData);
});
