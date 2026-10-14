import { eventHandler, getQuery } from 'h3';
import {
  findTenantRecord,
  isTenantRecordAvailable,
  toTenantInfo,
} from '~/utils/mock-data';
import { notFoundResponse, useResponseSuccess } from '~/utils/response';

/**
 * Public brand of a single tenant, for login pages locked by subdomain or
 * path. Unlike /tenant/list it never reveals other tenants.
 */
export default eventHandler((event) => {
  const code = String(getQuery(event).code ?? '');
  const tenant = findTenantRecord(code);
  if (!tenant || !isTenantRecordAvailable(tenant)) {
    return notFoundResponse(event, 'Tenant not found or unavailable.');
  }
  return useResponseSuccess(toTenantInfo(tenant));
});
