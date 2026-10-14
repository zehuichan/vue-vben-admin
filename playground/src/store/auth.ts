import type { Recordable, UserInfo } from '@vben/types';

import type { TenantApi } from '#/api';

import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  switchTenantApi,
} from '#/api';
import { $t } from '#/locales';
import { buildTenantUrl } from '#/utils/tenant';

import { useTenantStore } from './tenant';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const tenantStore = useTenantStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   * @param onSuccess 成功之后的回调函数
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      if (tenantStore.enabled) {
        params.tenantCode ||= tenantStore.tenantCode;
      }
      const { accessToken, tenantCode } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);
        if (tenantCode) {
          tenantStore.setTenantCode(tenantCode);
        }

        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);

        userInfo = fetchUserInfoResult;

        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            title: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  const isLoggingOut = ref(false); // 正在 logout 标识, 防止 /logout 死循环.

  async function logout(redirect: boolean = true) {
    if (isLoggingOut.value) return; // 正在登出中, 说明已进入循环, 直接返回.
    isLoggingOut.value = true; // 设置 标识

    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    } finally {
      isLoggingOut.value = false; // 重置 标识

      resetAllStores();
      accessStore.setLoginExpired(false);
    }

    // 已经在登录页时不能再带 redirect：此时 currentRoute.fullPath 就是登录页本身，
    // 再编码一层会得到「登录页?redirect=编码后的登录页」，下一次又在这个基础上再包一层，
    // 反复登出会让 URL 逐跳变长，且没有上限。
    // On the login page the current route is the login page itself, so carrying it as
    // `redirect` would nest one more encoded layer on every repeat.
    const currentRoute = router.currentRoute.value;
    const alreadyOnLogin = currentRoute.path === LOGIN_PATH;

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query:
        redirect && !alreadyOnLogin
          ? { redirect: encodeURIComponent(currentRoute.fullPath) }
          : {},
    });
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    syncTenant(userInfo);
    return userInfo;
  }

  /**
   * 同步用户信息中的当前租户与可切换的租户列表
   */
  function syncTenant(userInfo: UserInfo) {
    if (!tenantStore.enabled) {
      return;
    }
    const tenants: TenantApi.TenantInfo[] = userInfo.tenants ?? [];
    tenantStore.setTenantCode(userInfo.tenantCode ?? tenantStore.tenantCode);
    tenantStore.setTenantList(tenants);
    tenantStore.setHiddenMenus(userInfo.hiddenMenus ?? []);
    tenantStore.setTenantInfo(
      tenants.find((item) => item.code === tenantStore.tenantCode) ?? null,
    );
  }

  /**
   * 切换租户
   * 换取新 token 后刷新页面重新生成菜单和路由；路径前缀锁定时跳转到目标租户的路径。
   * 子域名锁定时目标租户不同源、无法共享登录态，只能跳转后重新登录。
   * @param tenantCode 目标租户编码
   */
  async function switchTenant(tenantCode: string) {
    if (!tenantStore.enabled || tenantCode === tenantStore.tenantCode) {
      return;
    }

    if (tenantStore.lockedBy === 'subdomain') {
      window.location.href = buildTenantUrl(tenantCode, 'subdomain');
      return;
    }

    const { accessToken, tenant } = await switchTenantApi({ tenantCode });
    accessStore.setAccessToken(accessToken);
    tenantStore.setTenantCode(tenantCode);
    accessStore.setAccessCodes(await getAccessCodesApi());

    if (tenantStore.lockedBy === 'path') {
      tenantStore.setTenantInfo(tenant);
      // 持久化插件在下一个 tick 写入 storage，跳转前需等待写入完成
      await nextTick();
      window.location.href = buildTenantUrl(tenantCode, 'path');
      return;
    }

    await router.replace(preferences.app.defaultHomePath);
    router.go(0);
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
    switchTenant,
  };
});
