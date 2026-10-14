import type { TenantRecord } from '~/utils/mock-data';

import { defineEventHandler, readBody } from 'h3';
import {
  findTenantRecord,
  findUser,
  formatDateTime,
  MOCK_TENANTS,
  MOCK_USERS,
} from '~/utils/mock-data';
import { badRequestResponse, useResponseSuccess } from '~/utils/response';
import { syncTenantMembers } from '~/utils/tenant-scope';
import {
  pickTenantPayload,
  toTenantListItem,
  validateTenantCode,
  validateTenantPackage,
  validateTenantPayload,
  verifyPlatformAdmin,
} from '~/utils/tenant-utils';

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,31}$/;

/**
 * Creating a tenant also provisions its administrator: an existing account is
 * added as admin, otherwise a new account is created with the given password.
 */
export default defineEventHandler(async (event) => {
  const admin = verifyPlatformAdmin(event);
  if (admin.response) {
    return admin.response;
  }

  const body = (await readBody(event)) ?? {};
  const code = String(body.code ?? '')
    .trim()
    .toLowerCase();
  const codeError = validateTenantCode(code);
  if (codeError) {
    return badRequestResponse(event, codeError);
  }
  if (findTenantRecord(code)) {
    return badRequestResponse(event, `Tenant code "${code}" already exists.`);
  }

  const payload = pickTenantPayload(body);
  const payloadError =
    validateTenantPayload(payload) ??
    (payload.name ? null : 'Tenant name is required.') ??
    validateTenantPackage(payload.packageId);
  if (payloadError) {
    return badRequestResponse(event, payloadError);
  }

  const adminUsername = String(body.adminUsername ?? '')
    .trim()
    .toLowerCase();
  const adminPassword = String(body.adminPassword ?? '');
  if (!USERNAME_PATTERN.test(adminUsername)) {
    return badRequestResponse(
      event,
      'Administrator username must be 3-32 lowercase letters, digits, underscores or hyphens, starting with a letter.',
    );
  }
  const existingAdmin = findUser(adminUsername);
  if (!existingAdmin && adminPassword.length < 6) {
    return badRequestResponse(
      event,
      'A password of at least 6 characters is required for a new administrator account.',
    );
  }

  const nextId =
    Math.max(0, ...MOCK_TENANTS.map((item) => Number(item.id))) + 1;
  const tenant: TenantRecord = {
    code,
    contactName: payload.contactName ?? '',
    contactPhone: payload.contactPhone ?? '',
    createTime: formatDateTime(new Date()),
    expireTime: payload.expireTime ?? '',
    id: String(nextId),
    logo:
      payload.logo ||
      `https://avatar.vercel.sh/${code}.svg?text=${code.slice(0, 2).toUpperCase()}`,
    name: payload.name as string,
    packageId: payload.packageId as string,
    remark: payload.remark ?? '',
    status: payload.status ?? 1,
  };

  if (!existingAdmin) {
    MOCK_USERS.push({
      homePath: '/dashboard/analytics',
      id: Math.max(0, ...MOCK_USERS.map((user) => user.id)) + 1,
      password: adminPassword,
      realName: String(body.adminRealName ?? '').trim() || adminUsername,
      username: adminUsername,
    });
  }

  MOCK_TENANTS.push(tenant);
  syncTenantMembers(code, payload.members ?? [], [adminUsername]);

  return useResponseSuccess(toTenantListItem(tenant));
});
