import { eventHandler, getQuery } from 'h3';
import {
  findMembership,
  MOCK_MEMBERSHIPS,
  MOCK_TENANTS,
  MOCK_USERS,
} from '~/utils/mock-data';
import { usePageResponseSuccess } from '~/utils/response';
import { isPlatformTenant } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

/** Display-only fields for the user management list, keyed by username */
const USER_PROFILES: Record<string, { createTime: string; remark: string }> = {
  admin: { createTime: '2024-01-02 10:00:00', remark: 'Administrator' },
  jack: { createTime: '2024-01-03 11:00:00', remark: 'Regular user' },
  vben: { createTime: '2024-01-01 09:00:00', remark: 'Super administrator' },
};

/**
 * Regular tenants only see their own members and their roles there. The
 * platform tenant sees every account plus its memberships, since accounts are
 * shared across tenants.
 */
function getUserListData(tenantCode: string) {
  const platform = isPlatformTenant(tenantCode);
  return MOCK_USERS.filter(
    (user) => platform || !!findMembership(user.username, tenantCode),
  ).map((user) => ({
    createTime: USER_PROFILES[user.username]?.createTime ?? '',
    id: String(user.id),
    name: user.realName,
    remark: USER_PROFILES[user.username]?.remark ?? '',
    roles: findMembership(user.username, tenantCode)?.roles ?? [],
    status: 1,
    tenants: platform
      ? MOCK_TENANTS.filter((tenant) =>
          MOCK_MEMBERSHIPS.some(
            (item) =>
              item.username === user.username &&
              item.tenantCode === tenant.code,
          ),
        ).map(({ code, name }) => ({ code, name }))
      : undefined,
    username: user.username,
  }));
}

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
  let listData = getUserListData(access.userinfo.tenantCode);
  if (name) {
    const keyword = String(name).toLowerCase();
    listData = listData.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.username.toLowerCase().includes(keyword),
    );
  }
  if (id) {
    listData = listData.filter((item) => item.id === String(id));
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
