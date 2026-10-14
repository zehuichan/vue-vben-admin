import { eventHandler, getQuery } from 'h3';
import { MOCK_MENU_LIST } from '~/utils/mock-data';
import { useResponseSuccess } from '~/utils/response';
import { verifyTenantAccess } from '~/utils/tenant-utils';

const namesMap: Record<string, any> = {};

function getNames(menus: any[]) {
  menus.forEach((menu) => {
    namesMap[menu.name] = String(menu.id);
    if (menu.children) {
      getNames(menu.children);
    }
  });
}
getNames(MOCK_MENU_LIST);

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }
  const { id, name } = getQuery(event);

  return (name as string) in namesMap &&
    (!id || namesMap[name as string] !== String(id))
    ? useResponseSuccess(true)
    : useResponseSuccess(false);
});
