export interface TenantInfo {
  code: string;
  logo: string;
  name: string;
}

export interface TenantRecord extends TenantInfo {
  contactName: string;
  contactPhone: string;
  createTime: string;
  /** YYYY-MM-DD, empty string means never expires */
  expireTime: string;
  id: string;
  /** Empty for the platform tenant, which always has every menu */
  packageId: string;
  remark: string;
  status: 0 | 1;
}

/** A sellable menu set; tenants only see menus included in their package */
export interface TenantPackageRecord {
  createTime: string;
  id: string;
  /** Menu ids from MOCK_MENU_LIST, platform-only menus excluded */
  menuIds: number[];
  name: string;
  remark: string;
  status: 0 | 1;
}

/** Login account; shared by every tenant the account belongs to */
export interface UserInfo {
  id: number;
  password: string;
  realName: string;
  username: string;
  homePath?: string;
}

/** Roles are granted per tenant, so one account can be admin in A and user in B */
export interface TenantMembership {
  roles: string[];
  tenantCode: string;
  username: string;
}

export interface TimezoneOption {
  offset: number;
  timezone: string;
}

/** Built-in platform tenant; cannot be deleted, disabled or expired */
export const DEFAULT_TENANT_CODE = 'default';

/** Platform administrator role, only grantable in the platform tenant */
export const PLATFORM_ADMIN_ROLE = 'super';
export const TENANT_ADMIN_ROLE = 'admin';
export const TENANT_USER_ROLE = 'user';

/**
 * Codes the playground subdomain resolver ignores (`RESERVED_SUBDOMAINS` in
 * playground/src/utils/tenant.ts); keep both lists in sync.
 */
export const RESERVED_TENANT_CODES = [
  'admin',
  'api',
  'app',
  'localhost',
  'www',
];

/** 2-32 chars, lowercase letters / digits / hyphen, starts with a letter */
export const TENANT_CODE_PATTERN = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

export const MOCK_TENANTS: TenantRecord[] = [
  {
    code: DEFAULT_TENANT_CODE,
    contactName: 'Vben',
    contactPhone: '13800000000',
    createTime: '2024-01-01 09:00:00',
    expireTime: '',
    id: '1',
    logo: 'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
    name: 'Vben Platform',
    packageId: '',
    remark: 'Built-in platform tenant',
    status: 1,
  },
  {
    code: 'acme',
    contactName: 'Wile E. Coyote',
    contactPhone: '13800000001',
    createTime: '2024-03-15 14:20:00',
    expireTime: '2099-12-31',
    id: '2',
    logo: 'https://avatar.vercel.sh/acme.svg?text=AC',
    name: 'Acme Corp',
    packageId: '1',
    remark: '',
    status: 1,
  },
  {
    code: 'nova',
    contactName: 'Hank Scorpio',
    contactPhone: '13800000002',
    createTime: '2024-06-01 10:00:00',
    expireTime: '2099-12-31',
    id: '3',
    logo: 'https://avatar.vercel.sh/nova.svg?text=NV',
    name: 'Nova Tech',
    packageId: '2',
    remark: '',
    status: 1,
  },
  {
    code: 'orbit',
    contactName: 'Bill Turner',
    contactPhone: '13800000003',
    createTime: '2024-09-09 16:45:00',
    expireTime: '',
    id: '4',
    logo: 'https://avatar.vercel.sh/orbit.svg?text=OR',
    name: 'Orbit Labs',
    packageId: '3',
    remark: 'Disabled tenant: hidden from login and tenant switcher',
    status: 0,
  },
  {
    code: 'umbrella',
    contactName: 'Albert Walker',
    contactPhone: '13800000004',
    createTime: '2023-02-20 08:30:00',
    expireTime: '2025-01-01',
    id: '5',
    logo: 'https://avatar.vercel.sh/umbrella.svg?text=UM',
    name: 'Umbrella Corp',
    packageId: '2',
    remark: 'Expired tenant: hidden from login and tenant switcher',
    status: 1,
  },
];

const BASIC_PACKAGE_MENU_IDS = [
  1, 101, 2, 202, 20_401, 20_402, 20_403, 203, 204, 205, 20_501, 20_502, 20_503,
  9, 901, 902, 903, 10,
];

export const MOCK_TENANT_PACKAGES: TenantPackageRecord[] = [
  {
    createTime: '2024-01-01 09:00:00',
    id: '1',
    menuIds: BASIC_PACKAGE_MENU_IDS,
    name: 'Basic',
    remark: 'Analytics and organization management',
    status: 1,
  },
  {
    createTime: '2024-01-01 09:00:00',
    id: '2',
    menuIds: [...BASIC_PACKAGE_MENU_IDS, 102],
    name: 'Standard',
    remark: 'Basic plus workspace',
    status: 1,
  },
  {
    createTime: '2024-01-01 09:00:00',
    id: '3',
    menuIds: [...BASIC_PACKAGE_MENU_IDS, 102, 3],
    name: 'Enterprise',
    remark: 'Standard plus demos',
    status: 1,
  },
];

export const MOCK_USERS: UserInfo[] = [
  {
    id: 0,
    password: '123456',
    realName: 'Vben',
    username: 'vben',
    homePath: '/dashboard/workspace',
  },
  {
    id: 1,
    password: '123456',
    realName: 'Admin',
    username: 'admin',
    homePath: '/dashboard/workspace',
  },
  {
    id: 2,
    password: '123456',
    realName: 'Jack',
    username: 'jack',
    homePath: '/dashboard/analytics',
  },
];

export const MOCK_MEMBERSHIPS: TenantMembership[] = [
  { roles: [PLATFORM_ADMIN_ROLE], tenantCode: 'default', username: 'vben' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'default', username: 'admin' },
  { roles: [TENANT_USER_ROLE], tenantCode: 'default', username: 'jack' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'acme', username: 'vben' },
  { roles: [TENANT_USER_ROLE], tenantCode: 'acme', username: 'admin' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'nova', username: 'vben' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'orbit', username: 'vben' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'umbrella', username: 'vben' },
  { roles: [TENANT_ADMIN_ROLE], tenantCode: 'umbrella', username: 'admin' },
];

/** Access codes granted by each role */
export const MOCK_ROLE_CODES: Record<string, string[]> = {
  [PLATFORM_ADMIN_ROLE]: ['AC_100100', 'AC_100110', 'AC_100120', 'AC_100010'],
  [TENANT_ADMIN_ROLE]: ['AC_100010', 'AC_100020', 'AC_100030'],
  [TENANT_USER_ROLE]: ['AC_1000001', 'AC_1000002'],
};

/** Local time as `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` */
export function formatDateTime(date: Date, withTime = true) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!withTime) {
    return day;
  }
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toTenantInfo({ code, logo, name }: TenantInfo): TenantInfo {
  return { code, logo, name };
}

export function findTenantRecord(code: string): TenantRecord | undefined {
  return MOCK_TENANTS.find((item) => item.code === code);
}

export function isTenantExpired(tenant: TenantRecord) {
  return (
    !!tenant.expireTime && tenant.expireTime < formatDateTime(new Date(), false)
  );
}

export function isTenantRecordAvailable(tenant: TenantRecord) {
  return tenant.status === 1 && !isTenantExpired(tenant);
}

/** Tenant exists, is enabled and not expired */
export function isTenantAvailable(code: string) {
  const tenant = findTenantRecord(code);
  return !!tenant && isTenantRecordAvailable(tenant);
}

export function getAvailableTenants(): TenantInfo[] {
  return MOCK_TENANTS.filter((tenant) => isTenantRecordAvailable(tenant)).map(
    (tenant) => toTenantInfo(tenant),
  );
}

export function getTenantByCode(code: string): TenantInfo | undefined {
  const tenant = findTenantRecord(code);
  return tenant ? toTenantInfo(tenant) : undefined;
}

export function findUser(username: string): undefined | UserInfo {
  return MOCK_USERS.find((item) => item.username === username);
}

export function findMembership(
  username: string,
  tenantCode: string,
): TenantMembership | undefined {
  return MOCK_MEMBERSHIPS.find(
    (item) => item.username === username && item.tenantCode === tenantCode,
  );
}

export function getTenantMemberships(tenantCode: string): TenantMembership[] {
  return MOCK_MEMBERSHIPS.filter((item) => item.tenantCode === tenantCode);
}

/** Available tenants the account belongs to, in tenant order */
export function getUserTenants(username: string): TenantInfo[] {
  return MOCK_TENANTS.filter(
    (tenant) =>
      !!findMembership(username, tenant.code) &&
      isTenantRecordAvailable(tenant),
  ).map((tenant) => toTenantInfo(tenant));
}

export function getAccessCodes(roles: string[]) {
  return [...new Set(roles.flatMap((role) => MOCK_ROLE_CODES[role] ?? []))];
}

export function findTenantPackage(id: string): TenantPackageRecord | undefined {
  return MOCK_TENANT_PACKAGES.find((item) => item.id === id);
}

const dashboardMenus = [
  {
    meta: {
      order: -1,
      title: 'page.dashboard.title',
    },
    name: 'Dashboard',
    path: '/dashboard',
    redirect: '/dashboard/analytics',
    children: [
      {
        name: 'Analytics',
        path: 'analytics',
        component: '/dashboard/analytics/index',
        meta: {
          affixTab: true,
          title: 'page.dashboard.analytics',
        },
      },
      {
        name: 'Workspace',
        path: 'workspace',
        component: '/dashboard/workspace/index',
        meta: {
          title: 'page.dashboard.workspace',
        },
      },
    ],
  },
];

const createDemosMenus = (role: 'admin' | 'super' | 'user') => {
  const roleWithMenus = {
    admin: {
      component: '/demos/access/admin-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.adminVisible',
      },
      name: 'AccessAdminVisibleDemo',
      path: 'admin-visible',
    },
    super: {
      component: '/demos/access/super-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.superVisible',
      },
      name: 'AccessSuperVisibleDemo',
      path: 'super-visible',
    },
    user: {
      component: '/demos/access/user-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.userVisible',
      },
      name: 'AccessUserVisibleDemo',
      path: 'user-visible',
    },
  };

  return [
    {
      meta: {
        icon: 'ic:baseline-view-in-ar',
        keepAlive: true,
        order: 1000,
        title: 'demos.title',
      },
      name: 'Demos',
      path: '/demos',
      redirect: '/demos/access',
      children: [
        {
          name: 'AccessDemos',
          path: 'access',
          meta: {
            icon: 'mdi:cloud-key-outline',
            title: 'demos.access.backendPermissions',
          },
          redirect: '/demos/access/page-control',
          children: [
            {
              name: 'AccessPageControlDemo',
              path: 'page-control',
              component: '/demos/access/index',
              meta: {
                icon: 'mdi:page-previous-outline',
                title: 'demos.access.pageAccess',
              },
            },
            {
              name: 'AccessButtonControlDemo',
              path: 'button-control',
              component: '/demos/access/button-control',
              meta: {
                icon: 'mdi:button-cursor',
                title: 'demos.access.buttonControl',
              },
            },
            {
              name: 'AccessMenuVisible403Demo',
              path: 'menu-visible-403',
              component: '/demos/access/menu-visible-403',
              meta: {
                authority: ['no-body'],
                icon: 'mdi:button-cursor',
                menuVisibleWithForbidden: true,
                title: 'demos.access.menuVisible403',
              },
            },
            roleWithMenus[role],
          ],
        },
      ],
    },
  ];
};

const createSystemMenus = (role: 'admin' | 'super' | 'user') => {
  if (role === TENANT_USER_ROLE) {
    return [];
  }
  const children = [
    {
      component: '/system/user/list',
      meta: { icon: 'mdi:user', title: 'system.user.title' },
      name: 'SystemUser',
      path: 'user',
    },
    {
      component: '/system/role/list',
      meta: { icon: 'mdi:account-group', title: 'system.role.title' },
      name: 'SystemRole',
      path: 'role',
    },
    {
      component: '/system/dept/list',
      meta: { icon: 'charm:organisation', title: 'system.dept.title' },
      name: 'SystemDept',
      path: 'dept',
    },
  ];
  if (role === PLATFORM_ADMIN_ROLE) {
    children.push({
      component: '/system/menu/list',
      meta: { icon: 'mdi:menu', title: 'system.menu.title' },
      name: 'SystemMenu',
      path: 'menu',
    });
  }
  return [
    {
      children,
      meta: {
        icon: 'ion:settings-outline',
        order: 9997,
        title: 'system.title',
      },
      name: 'System',
      path: '/system',
      redirect: '/system/user',
    },
  ];
};

const createTenantMenus = (role: 'admin' | 'super' | 'user') => {
  if (role !== PLATFORM_ADMIN_ROLE) {
    return [];
  }
  return [
    {
      children: [
        {
          component: '/tenant/list/index',
          meta: { icon: 'mdi:domain', title: 'tenant.list.title' },
          name: 'TenantList',
          path: 'list',
        },
        {
          component: '/tenant/package/index',
          meta: {
            icon: 'mdi:package-variant-closed',
            title: 'tenant.package.title',
          },
          name: 'TenantPackage',
          path: 'package',
        },
      ],
      meta: {
        icon: 'ion:business-outline',
        order: 9996,
        title: 'tenant.title',
      },
      name: 'Tenant',
      path: '/tenant',
      redirect: '/tenant/list',
    },
  ];
};

/** Backend-mode menus for the highest role the user holds in the tenant */
export function getRoleMenus(roles: string[]) {
  let role: 'admin' | 'super' | 'user' = TENANT_USER_ROLE;
  if (roles.includes(PLATFORM_ADMIN_ROLE)) {
    role = PLATFORM_ADMIN_ROLE;
  } else if (roles.includes(TENANT_ADMIN_ROLE)) {
    role = TENANT_ADMIN_ROLE;
  }
  return [
    ...dashboardMenus,
    ...createDemosMenus(role),
    ...createTenantMenus(role),
    ...createSystemMenus(role),
  ];
}

export const MOCK_MENU_LIST = [
  {
    id: 1,
    name: 'Dashboard',
    status: 1,
    type: 'catalog',
    icon: 'lucide:layout-dashboard',
    path: '/dashboard',
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: 'page.dashboard.title',
    },
    children: [
      {
        id: 101,
        pid: 1,
        status: 1,
        type: 'menu',
        name: 'Analytics',
        path: 'analytics',
        component: '/dashboard/analytics/index',
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          title: 'page.dashboard.analytics',
          keepAlive: true,
        },
      },
      {
        id: 102,
        pid: 1,
        status: 1,
        type: 'menu',
        name: 'Workspace',
        path: 'workspace',
        component: '/views/dashboard/workspace/index',
        meta: {
          icon: 'carbon:workspace',
          title: 'page.dashboard.workspace',
        },
      },
    ],
  },
  {
    id: 3,
    meta: {
      icon: 'ic:baseline-view-in-ar',
      order: 1000,
      title: 'demos.title',
    },
    name: 'Demos',
    path: '/demos',
    status: 1,
    type: 'catalog',
  },
  {
    id: 4,
    meta: {
      icon: 'ion:business-outline',
      order: 9996,
      title: 'tenant.title',
    },
    platformOnly: true,
    status: 1,
    type: 'catalog',
    name: 'Tenant',
    path: '/tenant',
    children: [
      {
        id: 401,
        pid: 4,
        path: '/tenant/list',
        name: 'TenantList',
        authCode: 'System:Tenant:List',
        platformOnly: true,
        status: 1,
        type: 'menu',
        meta: { icon: 'mdi:domain', title: 'tenant.list.title' },
        component: '/tenant/list/index',
      },
      {
        id: 402,
        pid: 4,
        path: '/tenant/package',
        name: 'TenantPackage',
        authCode: 'System:TenantPackage:List',
        platformOnly: true,
        status: 1,
        type: 'menu',
        meta: {
          icon: 'mdi:package-variant-closed',
          title: 'tenant.package.title',
        },
        component: '/tenant/package/index',
      },
    ],
  },
  {
    id: 2,
    meta: {
      icon: 'carbon:settings',
      order: 9997,
      title: 'system.title',
      badge: 'new',
      badgeType: 'normal',
      badgeVariants: 'primary',
    },
    status: 1,
    type: 'catalog',
    name: 'System',
    path: '/system',
    children: [
      {
        id: 201,
        pid: 2,
        path: '/system/menu',
        name: 'SystemMenu',
        authCode: 'System:Menu:List',
        platformOnly: true,
        status: 1,
        type: 'menu',
        meta: {
          icon: 'carbon:menu',
          title: 'system.menu.title',
        },
        component: '/system/menu/list',
        children: [
          {
            id: 20_101,
            pid: 201,
            name: 'SystemMenuCreate',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Create',
            meta: { title: 'common.create' },
          },
          {
            id: 20_102,
            pid: 201,
            name: 'SystemMenuEdit',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Edit',
            meta: { title: 'common.edit' },
          },
          {
            id: 20_103,
            pid: 201,
            name: 'SystemMenuDelete',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Delete',
            meta: { title: 'common.delete' },
          },
        ],
      },
      {
        id: 202,
        pid: 2,
        path: '/system/dept',
        name: 'SystemDept',
        status: 1,
        type: 'menu',
        authCode: 'System:Dept:List',
        meta: {
          icon: 'carbon:container-services',
          title: 'system.dept.title',
        },
        component: '/system/dept/list',
        children: [
          {
            id: 20_401,
            pid: 202,
            name: 'SystemDeptCreate',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Create',
            meta: { title: 'common.create' },
          },
          {
            id: 20_402,
            pid: 202,
            name: 'SystemDeptEdit',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Edit',
            meta: { title: 'common.edit' },
          },
          {
            id: 20_403,
            pid: 202,
            name: 'SystemDeptDelete',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Delete',
            meta: { title: 'common.delete' },
          },
        ],
      },
      {
        id: 203,
        pid: 2,
        path: '/system/user',
        name: 'SystemUser',
        authCode: 'System:User:List',
        status: 1,
        type: 'menu',
        meta: { icon: 'mdi:user', title: 'system.user.title' },
        component: '/system/user/list',
      },
      {
        id: 204,
        pid: 2,
        path: '/system/role',
        name: 'SystemRole',
        authCode: 'System:Role:List',
        status: 1,
        type: 'menu',
        meta: { icon: 'mdi:account-group', title: 'system.role.title' },
        component: '/system/role/list',
      },
      {
        id: 205,
        pid: 2,
        path: '/system/dict',
        name: 'SystemDict',
        status: 1,
        type: 'menu',
        authCode: 'System:Dict:List',
        meta: {
          icon: 'mdi:book-cog-outline',
          title: 'system.dict.title',
        },
        component: '/system/dict/list',
        children: [
          {
            id: 20_501,
            pid: 205,
            name: 'SystemDictCreate',
            status: 1,
            type: 'button',
            authCode: 'System:Dict:Create',
            meta: { title: 'common.create' },
          },
          {
            id: 20_502,
            pid: 205,
            name: 'SystemDictEdit',
            status: 1,
            type: 'button',
            authCode: 'System:Dict:Edit',
            meta: { title: 'common.edit' },
          },
          {
            id: 20_503,
            pid: 205,
            name: 'SystemDictDelete',
            status: 1,
            type: 'button',
            authCode: 'System:Dict:Delete',
            meta: { title: 'common.delete' },
          },
        ],
      },
    ],
  },
  {
    id: 9,
    meta: {
      badgeType: 'dot',
      order: 9998,
      title: 'demos.vben.title',
      icon: 'carbon:data-center',
    },
    name: 'Project',
    path: '/vben-admin',
    type: 'catalog',
    status: 1,
    children: [
      {
        id: 901,
        pid: 9,
        name: 'VbenDocument',
        path: '/vben-admin/document',
        component: 'IFrameView',
        type: 'embedded',
        status: 1,
        meta: {
          icon: 'carbon:book',
          iframeSrc: 'https://doc.vben.pro',
          title: 'demos.vben.document',
        },
      },
      {
        id: 902,
        pid: 9,
        name: 'VbenGithub',
        path: '/vben-admin/github',
        component: 'IFrameView',
        type: 'link',
        status: 1,
        meta: {
          icon: 'carbon:logo-github',
          link: 'https://github.com/vbenjs/vue-vben-admin',
          title: 'Github',
        },
      },
      {
        id: 903,
        pid: 9,
        name: 'VbenAntdv',
        path: '/vben-admin/antdv',
        component: 'IFrameView',
        type: 'link',
        status: 0,
        meta: {
          icon: 'carbon:hexagon-vertical-solid',
          badgeType: 'dot',
          link: 'https://ant.vben.pro',
          title: 'demos.vben.antdv',
        },
      },
    ],
  },
  {
    id: 10,
    component: '_core/about/index',
    type: 'menu',
    status: 1,
    meta: {
      icon: 'lucide:copyright',
      order: 9999,
      title: 'demos.vben.about',
    },
    name: 'About',
    path: '/about',
  },
];

export function getMenuIds(menus: any[]) {
  const ids: number[] = [];
  menus.forEach((item) => {
    ids.push(item.id);
    if (item.children && item.children.length > 0) {
      ids.push(...getMenuIds(item.children));
    }
  });
  return ids;
}

/**
 * 时区选项
 */
export const TIME_ZONE_OPTIONS: TimezoneOption[] = [
  {
    offset: -5,
    timezone: 'America/New_York',
  },
  {
    offset: 0,
    timezone: 'Europe/London',
  },
  {
    offset: 8,
    timezone: 'Asia/Shanghai',
  },
  {
    offset: 9,
    timezone: 'Asia/Tokyo',
  },
  {
    offset: 9,
    timezone: 'Asia/Seoul',
  },
];
