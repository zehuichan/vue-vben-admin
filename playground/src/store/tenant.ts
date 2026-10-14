import type { TenantApi } from '#/api';
import type { TenantLockSource } from '#/utils/tenant';

import { computed, ref } from 'vue';

import { preferencesManager, updatePreferences } from '@vben/preferences';

import { acceptHMRUpdate, defineStore } from 'pinia';

import { getTenantMode, resolveTenantFromLocation } from '#/utils/tenant';

export const useTenantStore = defineStore(
  'tenant',
  () => {
    /**
     * 是否启用多租户，tenantMode 为 single 时关闭
     */
    const enabled = ref(false);
    /**
     * 租户被访问地址锁定的来源（子域名 / 路径前缀）
     */
    const lockedBy = ref<null | TenantLockSource>(null);
    /**
     * 当前租户编码，通过请求头 X-Tenant-Id 传给后端
     */
    const tenantCode = ref<null | string>(null);
    const tenantInfo = ref<null | TenantApi.TenantInfo>(null);
    /**
     * 当前用户可切换的租户列表
     */
    const tenantList = ref<TenantApi.TenantInfo[]>([]);
    /**
     * 当前租户套餐未包含的路由名称，前端权限模式下据此过滤路由
     */
    const hiddenMenus = ref<string[]>([]);

    const isLocked = computed(() => lockedBy.value !== null);

    /**
     * 根据 tenantMode 与访问地址解析租户
     */
    function resolveTenant() {
      const mode = getTenantMode();
      const resolved = resolveTenantFromLocation(mode);
      enabled.value = mode !== 'single';
      lockedBy.value = resolved?.source ?? null;
      if (resolved) {
        tenantCode.value = resolved.code;
      }
    }

    function setTenantCode(code: null | string) {
      tenantCode.value = code;
    }

    /**
     * 设置当前租户，并同步应用名称与 logo
     */
    function setTenantInfo(info: null | TenantApi.TenantInfo) {
      tenantInfo.value = info;
      const { app, logo } = preferencesManager.getInitialPreferences();
      updatePreferences({
        app: { name: info?.name || app.name },
        logo: { source: info?.logo || logo.source },
      });
    }

    function setTenantList(list: TenantApi.TenantInfo[]) {
      tenantList.value = list;
    }

    function setHiddenMenus(names: string[]) {
      hiddenMenus.value = names;
    }

    // resetAllStores 时保留访问地址锁定的租户，登录页仍能识别
    function $reset() {
      tenantCode.value = null;
      tenantList.value = [];
      hiddenMenus.value = [];
      setTenantInfo(null);
      resolveTenant();
    }

    return {
      $reset,
      enabled,
      hiddenMenus,
      isLocked,
      lockedBy,
      resolveTenant,
      setHiddenMenus,
      setTenantCode,
      setTenantInfo,
      setTenantList,
      tenantCode,
      tenantInfo,
      tenantList,
    };
  },
  {
    persist: {
      pick: ['tenantCode', 'tenantInfo'],
    },
  },
);

const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useTenantStore, hot));
}
