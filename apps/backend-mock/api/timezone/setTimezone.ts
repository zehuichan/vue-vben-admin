import { eventHandler, readBody, setResponseStatus } from 'h3';
import { TIME_ZONE_OPTIONS } from '~/utils/mock-data';
import { useResponseError, useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';
import { setTimezone } from '~/utils/timezone-utils';

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  const body = await readBody<{ timezone?: unknown }>(event);
  const timezone =
    typeof body?.timezone === 'string' ? body.timezone : undefined;
  const allowed = TIME_ZONE_OPTIONS.some((o) => o.timezone === timezone);
  if (!timezone || !allowed) {
    setResponseStatus(event, 400);
    return useResponseError('Bad Request', 'Invalid timezone');
  }
  setTimezone(timezone);
  return useResponseSuccess({});
});
