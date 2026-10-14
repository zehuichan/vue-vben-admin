import { requestClient } from '#/api/request';

export namespace TenantApi {
  /** 租户信息 */
  export interface TenantInfo {
    code: string;
    logo: string;
    name: string;
  }

  /** 切换租户接口参数 */
  export interface SwitchTenantParams {
    tenantCode: string;
  }

  /** 切换租户接口返回值 */
  export interface SwitchTenantResult {
    accessToken: string;
    tenant: null | TenantInfo;
    tenantCode: string;
  }
}

/**
 * 获取租户列表（登录页选择）
 */
export async function getTenantListApi() {
  return requestClient.get<TenantApi.TenantInfo[]>('/tenant/list');
}

/**
 * 按编码获取单个可用租户的品牌信息（访问地址锁定租户时的登录页使用）
 */
export async function getTenantInfoApi(code: string) {
  return requestClient.get<TenantApi.TenantInfo>('/tenant/info', {
    params: { code },
  });
}

/**
 * 获取当前租户
 */
export async function getCurrentTenantApi() {
  return requestClient.get<null | TenantApi.TenantInfo>('/tenant/current');
}

/**
 * 切换租户，返回新的 accessToken
 */
export async function switchTenantApi(data: TenantApi.SwitchTenantParams) {
  return requestClient.post<TenantApi.SwitchTenantResult>(
    '/tenant/switch',
    data,
    {
      withCredentials: true,
    },
  );
}
