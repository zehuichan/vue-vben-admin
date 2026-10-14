import { defineEventHandler } from 'h3';
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { generateAccessToken, verifyRefreshToken } from '~/utils/jwt-utils';
import { findMembership, findUser, isTenantAvailable } from '~/utils/mock-data';
import { forbiddenResponse } from '~/utils/response';

export default defineEventHandler(async (event) => {
  const refreshToken = getRefreshTokenFromCookie(event);
  if (!refreshToken) {
    return forbiddenResponse(event);
  }

  clearRefreshTokenCookie(event);

  const userinfo = verifyRefreshToken(refreshToken);
  if (!userinfo) {
    return forbiddenResponse(event);
  }

  const user = findUser(userinfo.username);
  if (
    !user ||
    !findMembership(user.username, userinfo.tenantCode) ||
    !isTenantAvailable(userinfo.tenantCode)
  ) {
    return forbiddenResponse(event);
  }

  const accessToken = generateAccessToken(user, userinfo.tenantCode);

  setRefreshTokenCookie(event, refreshToken);

  return accessToken;
});
