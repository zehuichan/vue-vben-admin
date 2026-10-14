import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['super'],
      icon: 'ion:business-outline',
      order: 9996,
      title: $t('tenant.title'),
    },
    name: 'Tenant',
    path: '/tenant',
    children: [
      {
        path: 'list',
        name: 'TenantList',
        meta: {
          icon: 'mdi:domain',
          title: $t('tenant.list.title'),
        },
        component: () => import('#/views/tenant/list/index.vue'),
      },
      {
        path: 'package',
        name: 'TenantPackage',
        meta: {
          icon: 'mdi:package-variant-closed',
          title: $t('tenant.package.title'),
        },
        component: () => import('#/views/tenant/package/index.vue'),
      },
    ],
  },
];

export default routes;
