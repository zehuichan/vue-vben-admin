import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemTenantPackageApi {
  export interface SystemTenantPackage {
    [key: string]: any;
    createTime?: string;
    id: string;
    /** 套餐包含的菜单 ID（目录、菜单与按钮） */
    menuIds: number[];
    name: string;
    remark?: string;
    status: 0 | 1;
    /** 使用该套餐的租户数 */
    tenantCount?: number;
  }

  export interface PackageOption {
    disabled: boolean;
    label: string;
    value: string;
  }
}

/**
 * 获取租户套餐列表数据
 */
async function getTenantPackageList(params: Recordable<any>) {
  return requestClient.get<Array<SystemTenantPackageApi.SystemTenantPackage>>(
    '/system/tenant-package/list',
    { params },
  );
}

/**
 * 租户表单可选的套餐，停用的套餐为 disabled
 */
async function getTenantPackageOptions() {
  return requestClient.get<Array<SystemTenantPackageApi.PackageOption>>(
    '/system/tenant-package/options',
  );
}

/**
 * 创建租户套餐
 * @param data 套餐数据
 */
async function createTenantPackage(
  data: Omit<SystemTenantPackageApi.SystemTenantPackage, 'id'>,
) {
  return requestClient.post('/system/tenant-package', data);
}

/**
 * 更新租户套餐
 *
 * @param id 套餐 ID
 * @param data 套餐数据
 */
async function updateTenantPackage(
  id: string,
  data: Partial<Omit<SystemTenantPackageApi.SystemTenantPackage, 'id'>>,
) {
  return requestClient.put(`/system/tenant-package/${id}`, data);
}

/**
 * 删除租户套餐
 * @param id 套餐 ID
 */
async function deleteTenantPackage(id: string) {
  return requestClient.delete(`/system/tenant-package/${id}`);
}

export {
  createTenantPackage,
  deleteTenantPackage,
  getTenantPackageList,
  getTenantPackageOptions,
  updateTenantPackage,
};
