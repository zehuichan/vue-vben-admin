import type { EventHandlerRequest, H3Event } from 'h3';

import type { UserInfo } from './mock-data';

import { getHeader } from 'h3';
import jwt from 'jsonwebtoken';

import {
  DEFAULT_TENANT_CODE,
  findMembership,
  findUser,
  isTenantAvailable,
} from './mock-data';

// TODO: Replace with your own secret key
const ACCESS_TOKEN_SECRET = 'access_token_secret';
const REFRESH_TOKEN_SECRET = 'refresh_token_secret';

export interface TokenUserInfo extends Omit<UserInfo, 'password'> {
  /** Roles in the token's tenant, resolved per request */
  roles: string[];
  tenantCode: string;
}

export interface UserPayload extends TokenUserInfo {
  exp: number;
  iat: number;
  password?: string;
}

export type TenantContextError =
  | 'mismatch'
  | 'not-allowed'
  | 'unauthorized'
  | 'unavailable';

export type TenantContextResult =
  | { error: null; userinfo: TokenUserInfo }
  | { error: TenantContextError; userinfo: null };

export function generateAccessToken(user: UserInfo, tenantCode: string) {
  const { password: _pwd, ...rest } = user;
  return jwt.sign({ ...rest, tenantCode }, ACCESS_TOKEN_SECRET, {
    expiresIn: '7d',
  });
}

export function generateRefreshToken(user: UserInfo, tenantCode: string) {
  const { password: _pwd, ...rest } = user;
  return jwt.sign({ ...rest, tenantCode }, REFRESH_TOKEN_SECRET, {
    expiresIn: '30d',
  });
}

function toTokenUserInfo(user: UserInfo, tenantCode: string): TokenUserInfo {
  const { password: _pwd, ...userinfo } = user;
  return {
    ...userinfo,
    roles: findMembership(user.username, tenantCode)?.roles ?? [],
    tenantCode,
  };
}

export function verifyAccessToken(
  event: H3Event<EventHandlerRequest>,
): null | TokenUserInfo {
  const authHeader = getHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer')) {
    return null;
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2) {
    return null;
  }
  const token = tokenParts[1] as string;
  try {
    const decoded = jwt.verify(
      token,
      ACCESS_TOKEN_SECRET,
    ) as unknown as UserPayload;

    const user = findUser(decoded.username);
    if (!user) {
      return null;
    }
    return toTokenUserInfo(user, decoded.tenantCode || DEFAULT_TENANT_CODE);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): null | TokenUserInfo {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as UserPayload;
    const user = findUser(decoded.username);
    if (!user) {
      return null;
    }
    return toTokenUserInfo(user, decoded.tenantCode || DEFAULT_TENANT_CODE);
  } catch {
    return null;
  }
}

/**
 * Resolve tenant context from Authorization token + X-Tenant-Id header.
 */
export function getTenantContext(
  event: H3Event<EventHandlerRequest>,
): TenantContextResult {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return { error: 'unauthorized', userinfo: null };
  }

  const headerTenant = getHeader(event, 'X-Tenant-Id');
  if (headerTenant && headerTenant !== userinfo.tenantCode) {
    return { error: 'mismatch', userinfo: null };
  }

  // Membership and tenant status can change after the token was issued
  if (!findMembership(userinfo.username, userinfo.tenantCode)) {
    return { error: 'not-allowed', userinfo: null };
  }

  if (!isTenantAvailable(userinfo.tenantCode)) {
    return { error: 'unavailable', userinfo: null };
  }

  return { error: null, userinfo };
}
