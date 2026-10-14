import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import {
  DEFAULT_TENANT_CODE,
  findMembership,
  getUserTenants,
  isTenantAvailable,
  MOCK_USERS,
} from '~/utils/mock-data';
import {
  forbiddenResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default defineEventHandler(async (event) => {
  const {
    password,
    tenantCode: bodyTenantCode,
    username,
  } = await readBody(event);
  if (!password || !username) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Username and password are required',
    );
  }

  const findUser = MOCK_USERS.find(
    (item) => item.username === username && item.password === password,
  );

  if (!findUser) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'Username or password is incorrect.');
  }

  const tenantCode =
    (bodyTenantCode as string | undefined) ||
    getUserTenants(findUser.username)[0]?.code ||
    DEFAULT_TENANT_CODE;

  if (!findMembership(findUser.username, tenantCode)) {
    return forbiddenResponse(event, 'User does not belong to this tenant.');
  }

  if (!isTenantAvailable(tenantCode)) {
    return forbiddenResponse(event, 'Tenant is disabled or expired.');
  }

  const accessToken = generateAccessToken(findUser, tenantCode);
  const refreshToken = generateRefreshToken(findUser, tenantCode);

  setRefreshTokenCookie(event, refreshToken);

  const { password: _password, ...userinfo } = findUser;
  return useResponseSuccess({
    ...userinfo,
    accessToken,
    tenantCode,
  });
});
