import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { setRefreshTokenCookie } from '~/utils/cookie-utils';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
} from '~/utils/jwt-utils';
import {
  findMembership,
  findUser,
  getTenantByCode,
  isTenantAvailable,
} from '~/utils/mock-data';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default defineEventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const { tenantCode } = await readBody(event);
  if (!tenantCode || typeof tenantCode !== 'string') {
    setResponseStatus(event, 400);
    return useResponseError('BadRequestException', 'tenantCode is required');
  }

  if (!findMembership(userinfo.username, tenantCode)) {
    return forbiddenResponse(event, 'User does not belong to this tenant.');
  }

  if (!isTenantAvailable(tenantCode)) {
    return forbiddenResponse(event, 'Tenant is disabled or expired.');
  }

  const user = findUser(userinfo.username);
  if (!user) {
    return forbiddenResponse(event);
  }

  const accessToken = generateAccessToken(user, tenantCode);
  const refreshToken = generateRefreshToken(user, tenantCode);
  setRefreshTokenCookie(event, refreshToken);

  return useResponseSuccess({
    accessToken,
    tenant: getTenantByCode(tenantCode) ?? null,
    tenantCode,
  });
});
