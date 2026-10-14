import { eventHandler } from 'h3';
import { getAvailableTenants } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';

/**
 * Public tenant list for login-page selection (enabled and not expired only).
 */
export default eventHandler(() => {
  return useResponseSuccess(getAvailableTenants());
});
