import { eventHandler, getQuery } from 'h3';
import { MOCK_MENU_LIST } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

const pathMap: Record<string, any> = { '/': 0 };

function getPaths(menus: any[]) {
  menus.forEach((menu) => {
    pathMap[menu.path] = String(menu.id);
    if (menu.children) {
      getPaths(menu.children);
    }
  });
}
getPaths(MOCK_MENU_LIST);

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  const { id, path } = getQuery(event);

  return (path as string) in pathMap &&
    (!id || pathMap[path as string] !== String(id))
    ? useResponseSuccess(true)
    : useResponseSuccess(false);
});
