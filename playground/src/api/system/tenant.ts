import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemTenantApi {
  export interface SystemTenant {
    [key: string]: any;
    /** 租户管理员用户名；平台租户的角色不通过该字段修改 */
    admins?: string[];
    /** 启用且未过期 */
    available?: boolean;
    /** 租户编码，创建后不可修改（用于 X-Tenant-Id、子域名与 /t/:code 前缀） */
    code: string;
    contactName?: string;
    contactPhone?: string;
    createTime?: string;
    expired?: boolean;
    /** YYYY-MM-DD，空字符串表示永不过期 */
    expireTime?: string;
    id: string;
    logo?: string;
    /** 成员用户名 */
    members: string[];
    name: string;
    /** 平台租户不绑定套餐，为空字符串 */
    packageId?: string;
    packageName?: string;
    remark?: string;
    status: 0 | 1;
  }

  /** 创建租户时一并初始化管理员账号 */
  export interface CreateTenantParams extends Omit<SystemTenant, 'id'> {
    adminPassword?: string;
    adminUsername: string;
  }

  export interface MemberOption {
    label: string;
    value: string;
  }
}

/**
 * 获取租户列表数据
 */
async function getTenantList(params: Recordable<any>) {
  return requestClient.get<Array<SystemTenantApi.SystemTenant>>(
    '/system/tenant/list',
    { params },
  );
}

/**
 * 可分配给租户的登录账号
 */
async function getTenantMemberOptions() {
  return requestClient.get<Array<SystemTenantApi.MemberOption>>(
    '/system/tenant/member-options',
  );
}

async function isTenantCodeExists(
  code: string,
  id?: SystemTenantApi.SystemTenant['id'],
) {
  return requestClient.get<boolean>('/system/tenant/code-exists', {
    params: { code, id },
  });
}

/**
 * 创建租户
 * @param data 租户数据
 */
async function createTenant(data: SystemTenantApi.CreateTenantParams) {
  return requestClient.post('/system/tenant', data);
}

/**
 * 更新租户
 *
 * @param id 租户 ID
 * @param data 租户数据
 */
async function updateTenant(
  id: string,
  data: Partial<Omit<SystemTenantApi.SystemTenant, 'code' | 'id'>>,
) {
  return requestClient.put(`/system/tenant/${id}`, data);
}

/**
 * 删除租户
 * @param id 租户 ID
 */
async function deleteTenant(id: string) {
  return requestClient.delete(`/system/tenant/${id}`);
}

export {
  createTenant,
  deleteTenant,
  getTenantList,
  getTenantMemberOptions,
  isTenantCodeExists,
  updateTenant,
};
