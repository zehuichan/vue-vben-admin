import { resetAllStores, useAccessStore } from '@vben/stores';

import { useTenantStore } from '#/store';

/**
 * 初始化多租户，访问地址锁定的租户与本地会话不一致时清空会话重新登录
 */
export function initTenant() {
  const accessStore = useAccessStore();
  const tenantStore = useTenantStore();
  const sessionTenantCode = tenantStore.tenantCode;

  tenantStore.resolveTenant();

  if (
    accessStore.accessToken &&
    sessionTenantCode &&
    sessionTenantCode !== tenantStore.tenantCode
  ) {
    resetAllStores();
  }
}
