---
outline: deep
---

# 多租户

本文是 `playground` 多租户方案的设计文档。内容包括：租户如何识别，租户上下文如何在前后端之间传递，角色、菜单与数据如何按租户隔离，平台如何通过套餐管理租户，以及对接真实后端时需要满足的约定。

::: tip 适用范围

当前实现位于 `playground`（前端）与 `apps/backend-mock`（模拟后端），其他应用（`web-antd`、`web-ele` 等）未内置。如需在自己的应用中落地，可参照本文与[相关文件](#相关文件)迁移。

:::

## 设计目标

- **一个账号，多个租户**：账号是全局的，通过成员关系加入多个租户，并且**在每个租户中可以拥有不同的角色**。
- **平台与租户分离**：只有平台租户中的平台管理员可以管理租户和套餐；租户管理员只能管理本租户的用户、角色与部门。
- **套餐控制功能范围**：租户可用的菜单由套餐决定，套餐变更后无需改动角色即可生效。
- **多种识别方式**：支持子域名（`acme.example.com`）、路径前缀（`/t/acme/`）、登录页选择三种方式，可按部署形态切换，也可完全关闭。
- **后端为准**：租户上下文由后端签发在 token 中，角色按请求实时解析，前端只负责携带与展示，不能通过篡改请求头越权。
- **即时失效**：租户被停用、过期，或用户被移出、被调整角色后，已签发的 token 立即按新状态生效。
- **对现有框架侵入最小**：不修改 `@vben/*` 核心包，只在应用层通过偏好扩展、Store、请求拦截器、路由生成和布局插槽接入。

**非目标**：本方案不涉及数据库层面的隔离策略（共享表 + `tenant_id`、独立 Schema 或独立库），这些由后端自行决定；也不涉及按租户定制主题、语言等偏好（目前只同步应用名称和 Logo）。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| 租户（Tenant） | 隔离单元，以唯一的**租户编码**（`code`）标识，例如 `acme`。 |
| 租户编码 | 同时用于请求头 `X-Tenant-Id`、子域名和路径前缀，因此**创建后不可修改**。 |
| 账号 | 全局唯一的登录账号（用户名 + 密码），本身不带角色。 |
| 成员关系（Membership） | `账号 + 租户 + 角色`。只有成员才能登录该租户，角色只在该租户内有效。 |
| 平台租户 | 内置租户 `default`，不能删除、停用或设置过期，不绑定套餐，可使用全部菜单。 |
| 平台管理员 | 平台租户中角色为 `super` 的成员，唯一可以管理租户与套餐的身份。`super` 角色只能在平台租户中授予。 |
| 租户管理员 | 某租户中角色为 `admin` 的成员，管理本租户的用户、角色与部门。每个普通租户至少有一名。 |
| 普通成员 | 角色为 `user` 的成员。 |
| 套餐（Package） | 一组菜单 ID，决定普通租户可使用的菜单范围。 |
| 平台专属菜单 | 标记为 `platformOnly` 的菜单（菜单管理，以及「租户管理」目录及其下的租户列表、租户套餐），任何套餐都不能包含。 |
| 可用租户 | 状态为启用（`status = 1`）且未过期（`expireTime` 为空或不早于今天）的租户。 |
| 租户上下文 | 当前请求所属的租户，来源于 access token 中的 `tenantCode` 声明。 |
| 锁定 | 租户由访问地址（子域名或路径前缀）决定时称为"锁定"，此时登录页的租户选择不可修改。 |

## 整体架构

```text
[浏览器]
  访问地址（子域名 / /t/:code/）
      │  utils/tenant.ts 解析租户
      ▼
  tenantStore：enabled / lockedBy / tenantCode / tenantInfo / tenantList / hiddenMenus
      ▲
      │  login / syncTenant / switchTenant
  authStore ◄── 登录页（锁定时查询 /tenant/info 展示品牌）/ Logo 区切换器
      │
      ├──► router/access.ts：静态路由按 hiddenMenus 裁剪后再按角色生成
      ▼
  request.ts 请求拦截器
      Authorization: Bearer <token，载荷含 tenantCode>
      X-Tenant-Id: <tenantCode>
      │
──────┼──────────────────────────────────────────────
      ▼
[后端]
  getTenantContext / verifyTenantAccess
      1. 校验 access token
      2. X-Tenant-Id 与 token 中的 tenantCode 一致
      3. 查询成员关系，得到该租户内的角色
      4. 租户可用（启用且未过期）
      │
      ├──► 菜单 = 角色菜单 ∩ 套餐菜单
      ├──► 权限码按该租户内的角色生成
      ├──► 业务数据按租户隔离（用户、角色、部门、表格等）
      └──► 平台接口额外要求：平台租户 + super（verifyPlatformAdmin）
```

## 租户识别

### 识别模式

识别模式通过偏好扩展字段 `tenantMode` 配置（定义在 `playground/src/preferences.ts`），可在偏好设置抽屉的业务偏好标签页中修改，**修改后需刷新页面**才会生效。

| 模式 | 识别方式 | 是否锁定 | 适用场景 |
| --- | --- | --- | --- |
| `auto`（默认） | 子域名 > 路径前缀 > 登录选择 | 命中子域名或路径时锁定 | 同一套代码兼容多种部署 |
| `subdomain` | 仅子域名 | 是 | 每个租户独立域名 |
| `path` | 仅路径前缀 `/t/:code/` | 是 | 只有一个域名，无法配置泛域名解析 |
| `select` | 登录页选择、Logo 区切换 | 否 | 内部系统，用户自行选择租户 |
| `single` | 关闭多租户 | — | 单租户系统，不显示任何租户相关 UI，也不发送 `X-Tenant-Id` |

### 子域名解析规则

`resolveTenantFromHostname` 取主机名的第一段作为租户编码，但以下情况不识别：

- 主机名是 `localhost` 或 IPv4 地址；
- 段数不足：`*.localhost` 至少 2 段（`acme.localhost`），其他域名至少 3 段（`acme.example.com`）；
- 第一段是保留子域名：`admin`、`api`、`app`、`localhost`、`www`。

::: warning 保留编码需前后端同步

前端的 `RESERVED_SUBDOMAINS`（`playground/src/utils/tenant.ts`）与后端的 `RESERVED_TENANT_CODES`（`apps/backend-mock/utils/mock-data.ts`）必须保持一致，后端会拒绝用保留编码创建租户，避免出现无法通过子域名访问的租户。

:::

### 路径前缀与路由 base

路径前缀模式下，租户编码出现在 URL 中，例如 `/t/acme/dashboard`。为了让应用内的路由表不感知租户前缀，`getTenantRouterBase` 会把路由 `base` 设置为 `${VITE_BASE}t/acme/`，路由守卫和菜单中的路径仍然是 `/dashboard`。该逻辑同样兼容 `VITE_BASE` 非根路径（如 `/app/t/acme/`）和 hash 路由。

解析结果在模块内缓存，确保创建路由（模块加载时）和 `initTenant`（启动时）拿到同一个结果。由于 `initPreferences` 在动态导入 `bootstrap` 之前执行，路由模块加载时已能读到 `tenantMode`。

## 租户上下文

### 双重携带：token 声明 + 请求头

- **token 声明（权威来源）**：后端在登录、切换租户、刷新 token 时，把 `tenantCode` 写入 access token 和 refresh token 的载荷中。后端只信任 token 中的租户。
- **`X-Tenant-Id` 请求头（一致性校验）**：请求拦截器在多租户开启且存在 `tenantCode` 时附加该请求头。后端发现请求头与 token 声明不一致时返回 `403 Tenant mismatch`。

请求头不能用来切换租户，它的作用是让前端状态和 token 不一致的问题（例如本地状态被篡改、多个标签页状态错乱）尽早暴露出来，而不是静默地按另一个租户返回数据。

角色**不写入 token**：每次请求都根据 `用户名 + tenantCode` 查询成员关系得到当前角色，因此调整角色、移出成员都能立即生效，无需重新签发 token。

### 前端状态

`useTenantStore`（`playground/src/store/tenant.ts`）维护以下状态：

| 字段 | 说明 | 持久化 |
| --- | --- | --- |
| `enabled` | `tenantMode !== 'single'` | 否，每次启动重新计算 |
| `lockedBy` | 锁定来源：`subdomain` / `path` / `null` | 否 |
| `tenantCode` | 当前租户编码 | 是 |
| `tenantInfo` | 当前租户名称、Logo，变化时同步到 `preferences.app.name` 和 `preferences.logo.source` | 是 |
| `tenantList` | 当前用户可切换的租户 | 否，从用户信息接口获取 |
| `hiddenMenus` | 当前租户套餐未包含的路由名称 | 否，从用户信息接口获取 |

`$reset`（登出时由 `resetAllStores` 调用）会清空会话相关字段，但会重新执行 `resolveTenant`，保留访问地址锁定的租户，确保登出后登录页仍然锁定在该租户。

### 会话一致性

子域名模式下，每个租户是不同的 origin，`localStorage` 天然隔离。路径前缀模式下，所有租户共享同一个 origin，本地可能保存着 A 租户的 token，而用户访问的是 `/t/b/`。`initTenant`（`playground/src/tenant-init.ts`）在启动时处理这种情况：

```text
启动 → 读取本地保存的 tenantCode → 按访问地址解析租户
     → 存在 accessToken 且两者不一致 → resetAllStores()，回到登录页
```

通过 Logo 区切换器在路径前缀模式下切换租户时，会先换取目标租户的 token 并写入新的 `tenantCode`，再跳转到目标路径，因此不会触发上述重置（见[切换租户](#切换租户)）。

## 关键流程

### 登录

1. 多租户开启时，登录页按是否锁定选择不同的数据来源：
   - **锁定**：调用 `GET /tenant/info?code=<编码>` 只查询该租户，把名称和 Logo 应用到登录页（`setTenantInfo`），租户下拉框禁用，副标题提示"当前租户已由访问地址锁定"。租户不存在、已停用或已过期时接口返回 404，副标题改为对应提示，并恢复默认品牌。
   - **未锁定**：调用 `GET /tenant/list` 渲染租户下拉框。本地记住的租户（例如之前访问过的锁定地址，或已被停用的租户）不在列表中时，改选第一个可用租户。
2. 提交时 `authLogin` 用 `tenantStore.tenantCode` 补全未填写的 `tenantCode`。
3. 后端校验账号密码 → 确定租户（请求体 > 用户第一个可用租户 > `default`）→ 校验成员关系 → 校验租户可用 → 签发带 `tenantCode` 的 token。
4. 前端保存 token 和返回的 `tenantCode`，并行获取用户信息与权限码。
5. 用户信息接口返回 `tenantCode`、当前租户内的 `roles`、`tenants`（可切换的租户列表）、`hiddenMenus` 和按套餐修正后的 `homePath`，`syncTenant` 据此更新 `tenantStore`。

### 切换租户

租户切换器位于 Logo 区，使用 `@vben/layouts` 提供的 `TenantToggle`。`basic.vue` 通过 `BasicLayout` 的 `logo` 插槽接入它，并传入租户列表与当前租户编码。Logo 和名称已同步为当前租户的品牌，用户拥有至少一个租户时，点击 Logo 区展开租户列表，选择后调用 `authStore.switchTenant`：

| 场景 | 行为 | 是否需要重新登录 |
| --- | --- | --- |
| 未锁定 | 调用 `POST /tenant/switch` 换取新 token（后端同时重写 refresh token Cookie），更新 `tenantCode` 与权限码后跳转首页并整页刷新 | 否 |
| 路径前缀锁定 | 同样先换取新 token、更新 `tenantCode`、权限码和品牌，等待持久化写入后跳转到 `/t/:code/` | 否 |
| 子域名锁定 | 直接跳转到目标子域名。不同 origin 之间无法共享登录态，由目标地址重新走登录流程 | 是 |

整页刷新是为了让动态菜单、路由和各页面缓存全部按新租户重建。

### Token 刷新

`POST /auth/refresh` 沿用 refresh token 中的 `tenantCode` 签发新的 access token，签发前重新校验成员关系和租户可用性，任一不满足则返回 403，前端进入重新登录流程。

### 租户失效

租户被停用、过期，或用户被移出租户后，`getTenantContext` 在下一次请求时返回 401。前端的 `authenticateResponseInterceptor` 会先尝试刷新 token，刷新接口同样校验失败，最终按 `loginExpiredMode` 弹出登录框或跳转登录页。

## 权限模型

### 角色按租户授予

角色挂在成员关系上，而不是账号上。同一账号可以是平台租户的平台管理员，同时是 A 租户的租户管理员、B 租户的普通成员：

| 角色 | 可授予的租户 | 能力 |
| --- | --- | --- |
| `super` 平台管理员 | 仅平台租户 | 全部菜单；管理租户、套餐与菜单 |
| `admin` 租户管理员 | 任意租户 | 本租户的用户、角色、部门管理，以及套餐内的其他菜单 |
| `user` 普通成员 | 任意租户 | 概览、演示、项目、关于等基础菜单（同样受套餐限制） |

权限码（`/auth/codes`）和后端菜单（`/menu/all`）都按当前租户内的角色生成。前端静态路由通过 `meta.authority` 按角色过滤，例如「租户管理」目录和菜单管理配置为 `authority: ['super']`。

### 平台与租户分离

租户与套餐管理接口统一通过 `verifyPlatformAdmin` 校验：**当前租户是平台租户，并且在平台租户中的角色为 `super`**。因此：

- 平台租户中的 `admin` 不能管理租户；
- 即使某账号是平台管理员，切换到普通租户后也不能管理租户，必须回到平台租户操作；
- 平台接口不受当前租户的数据过滤影响，可以看到全部租户。

### 套餐与菜单裁剪

普通租户的可用菜单由套餐计算得出（`getTenantMenuCatalog`）：

1. 取套餐的 `menuIds`；
2. 父级菜单在任一子级被授予时保留；
3. 平台专属菜单始终剔除。

不在可用范围内的菜单名称即为 `hiddenMenus`。三种[权限模式](./access.md)下的裁剪方式：

| 权限模式 | 裁剪位置 |
| --- | --- |
| `backend` | `/menu/all` 返回 `角色菜单 ∩ 套餐菜单` |
| `frontend` | `router/access.ts` 先用 `hiddenMenus` 移除静态路由，再按角色生成菜单 |
| `mixed` | 以上两者都执行，再按路由名称合并 |

平台租户的 `hiddenMenus` 为空。套餐只管控菜单目录（`MOCK_MENU_LIST`）中登记的菜单，目录之外的静态路由（例如 `playground` 的「示例」）不受套餐影响。

用户首页如果被套餐隐藏，用户信息接口会把 `homePath` 回落到 `/dashboard/analytics`，避免登录后落到 404。

## 数据隔离

所有需要租户上下文的接口统一通过 `verifyTenantAccess` 获取当前用户、租户和角色，然后按租户返回数据：

| 接口 | 隔离方式 |
| --- | --- |
| `system/user/list` | 普通租户只返回本租户成员及其在本租户内的角色；平台租户返回全部账号，并附带每个账号所属的租户 |
| `system/role/list` | 返回本租户内的角色定义（平台租户额外包含平台管理员），权限按租户可用菜单取交集 |
| `system/menu/list` | 返回租户可用的菜单目录，供角色授权使用 |
| `system/dept/list` | 每个租户独立的部门数据 |
| `table/list` | 每个租户独立的表格数据 |
| 其余需要登录的接口（部门写操作、菜单校验、上传、时区等） | 校验租户上下文，`X-Tenant-Id` 不一致或租户不可用时拒绝 |

模拟后端用租户编码作为随机种子生成部门和表格数据，同一租户每次看到的数据一致，不同租户互不相同。

## 租户管理

平台能力放在一级目录「租户管理」下，与租户内的「系统管理」（用户、角色、部门）分开，只对平台管理员可见：

- 「租户管理 → 租户列表」（`/tenant/list`，页面 `playground/src/views/tenant/list`）
- 「租户管理 → 租户套餐」（`/tenant/package`，页面 `playground/src/views/tenant/package`）

### 租户数据模型

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 主键 |
| `code` | `string` | 租户编码，创建后不可修改 |
| `name` | `string` | 租户名称，必填，最长 50 |
| `packageId` | `string` | 套餐 ID，普通租户必填；平台租户为空字符串 |
| `logo` | `string` | Logo 地址，未填时自动生成 |
| `status` | `0 \| 1` | 停用 / 启用 |
| `expireTime` | `string` | `YYYY-MM-DD`，空字符串表示永不过期 |
| `members` | `string[]` | 成员用户名，实际存储为成员关系 |
| `admins` | `string[]` | 角色为 `admin` 的成员，是 `members` 的子集；平台租户的角色不通过该字段修改 |
| `contactName` / `contactPhone` / `remark` | `string` | 联系人、联系电话、备注 |
| `createTime` | `string` | 创建时间 |
| `available` / `expired` / `packageName` | — | 列表接口计算得出，只读 |

### 创建租户与初始化管理员

创建租户时必须指定套餐和管理员账号（`adminUsername`）：

- 账号已存在：直接以租户管理员身份加入新租户；
- 账号不存在：用 `adminPassword`（至少 6 位）创建新账号，再加入新租户；
- `members` 中的其他账号以普通成员身份加入。

这样新租户创建后立即有人可以登录并管理，不需要平台管理员再手工配置。

### 校验与保护规则

- **编码格式**：2–32 位小写字母、数字或连字符，以字母开头，不能以连字符结尾（`/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/`）；不能是保留编码；全局唯一。前端表单与后端都会校验。
- **编码不可修改**：编码已写入 token、URL 和子域名，修改会导致已签发的 token 和已分发的地址全部失效。更新接口会忽略 `code` 字段。
- **至少一名管理员**：编辑普通租户时，`admins` 不能为空，且只保留仍在 `members` 中的账号。平台租户编辑成员时保留已有角色，新成员以普通成员身份加入。
- **受保护租户**：平台租户 `default` 和操作者当前登录的租户不能删除、停用或设置为已过期，避免把自己锁在系统外。
- **不能移出自己**：编辑当前登录租户的成员时，不能把自己移出。
- **删除租户**：同时删除该租户的全部成员关系；账号本身保留。

### 套餐数据模型与规则

| 字段                    | 类型       | 说明                              |
| ----------------------- | ---------- | --------------------------------- |
| `id`                    | `string`   | 主键                              |
| `name`                  | `string`   | 套餐名称，必填且唯一              |
| `menuIds`               | `number[]` | 包含的菜单 ID（目录、菜单与按钮） |
| `status`                | `0 \| 1`   | 停用 / 启用                       |
| `remark` / `createTime` | `string`   | 备注、创建时间                    |
| `tenantCount`           | `number`   | 使用该套餐的租户数，只读          |

- 保存时自动剔除平台专属菜单，前端菜单树也不展示它们。
- 停用的套餐不能再分配给其他租户，已在使用的租户不受影响。
- 仍有租户使用的套餐不能删除。
- 修改套餐或调整租户的套餐后，接口在下一次请求时按新套餐返回；前端路由在登录或刷新页面时重新生成。

::: info 演示环境写入限制

模拟后端默认拦截 `/api/system/*` 下的写操作并返回"演示环境，禁止修改"。由于租户与套餐数据直接影响登录、切换和隔离的演示效果，`/api/system/tenant` 前缀（包括 `/api/system/tenant-package`）被加入了白名单（`apps/backend-mock/middleware/1.api.ts`）。模拟数据保存在内存中，重启服务后恢复初始状态。

:::

## 接口约定

| 接口 | 鉴权 | 说明 |
| --- | --- | --- |
| `POST /auth/login` | 无 | 请求体新增可选的 `tenantCode`；响应新增 `tenantCode`，不含密码 |
| `POST /auth/refresh` | refresh token Cookie | 沿用 refresh token 中的租户，并重新校验 |
| `GET /user/info` | 租户上下文 | 响应新增 `tenantCode`、`roles`（当前租户内）、`tenants`、`hiddenMenus`，`homePath` 按套餐修正 |
| `GET /auth/codes` | 租户上下文 | 按当前租户内的角色返回权限码 |
| `GET /menu/all` | 租户上下文 | 角色菜单与套餐菜单取交集 |
| `GET /tenant/info?code=` | 无 | 锁定登录页使用，只返回该租户的 `code`、`name`、`logo`；不存在或不可用时 404 |
| `GET /tenant/list` | 无 | 未锁定的登录页使用，返回可用租户的 `code`、`name`、`logo` |
| `GET /tenant/current` | 租户上下文 | 当前租户信息 |
| `POST /tenant/switch` | access token | 请求体 `{ tenantCode }`，返回 `{ accessToken, tenantCode, tenant }`，并重写 refresh token Cookie |
| `GET /system/tenant/list` | 平台管理员 | 分页，支持按 `name`、`code`、`status`、`startTime`、`endTime` 筛选 |
| `GET /system/tenant/member-options` | 平台管理员 | 可分配的账号 |
| `GET /system/tenant/code-exists` | 平台管理员 | 参数 `code`、`id`（编辑时排除自身） |
| `POST /system/tenant` | 平台管理员 | 创建租户，必填 `packageId`、`adminUsername`，新账号需 `adminPassword` |
| `PUT /system/tenant/:id` | 平台管理员 | 部分更新，忽略 `code`；支持 `packageId`、`members`、`admins` |
| `DELETE /system/tenant/:id` | 平台管理员 | 删除租户及其成员关系 |
| `GET /system/tenant-package/list` | 平台管理员 | 分页，支持按 `name`、`status` 筛选 |
| `GET /system/tenant-package/options` | 平台管理员 | 租户表单的套餐选项，停用的套餐带 `disabled` |
| `POST /system/tenant-package` | 平台管理员 | 创建套餐 |
| `PUT /system/tenant-package/:id` | 平台管理员 | 更新套餐 |
| `DELETE /system/tenant-package/:id` | 平台管理员 | 删除未被使用的套餐 |

"租户上下文"指同时满足：access token 有效、`X-Tenant-Id`（如有）与 token 一致、用户是该租户成员、租户可用。"平台管理员"指在租户上下文的基础上，当前租户为平台租户且角色为 `super`。CORS 配置需要在 `Access-Control-Allow-Headers` 中放行 `X-Tenant-Id`。

### 错误语义

| 场景 | 状态码 | 前端表现 |
| --- | --- | --- |
| 登录时用户不属于该租户 | 403 | 提示错误，停留在登录页 |
| 登录或切换时租户已停用/过期 | 403 | 提示错误 |
| 锁定的租户不存在或不可用 | 404（`/tenant/info`） | 登录页副标题提示 |
| `X-Tenant-Id` 与 token 不一致 | 403 `Tenant mismatch` | 提示错误，不自动登出 |
| 用户已被移出租户，或租户已停用/过期 | 401 | 尝试刷新 token，失败后重新登录 |
| 非平台管理员访问租户或套餐管理接口 | 403 | 提示错误 |
| 创建/编辑租户时缺少套餐、管理员，或套餐已停用 | 400 | 提示错误 |

## 对接真实后端

模拟后端只演示了约定，真实后端需要实现以下内容：

1. **token 携带租户**：登录、切换、刷新签发的 token 都必须包含 `tenantCode`；租户只能从 token 中读取，不能直接信任请求头或请求参数。
2. **每次请求校验**：校验 `X-Tenant-Id` 与 token 一致、成员关系有效、租户可用，并从成员关系读取角色。成员关系和租户状态可以缓存，但停用、移出、调整角色时需要让缓存失效，否则无法做到即时失效。
3. **业务数据过滤**：所有业务查询与写入都附带当前租户条件（或切换到租户对应的 Schema/数据源），推荐在 ORM/数据访问层统一注入，而不是在每个接口里手写。
4. **refresh token 与租户绑定**：切换租户时重新签发 refresh token，旧的 refresh token 应作废。
5. **平台能力与租户能力分离**：租户、套餐等平台接口只允许平台租户中的平台角色访问，并且不受当前租户过滤影响。
6. **套餐裁剪在后端完成**：菜单、权限码与接口权限都应按套餐裁剪；前端的 `hiddenMenus` 只负责展示，不能替代后端的接口鉴权。
7. **租户初始化**：创建租户时在同一事务中创建管理员成员关系（以及默认角色、部门等租户级数据）。
8. **替换密钥**：`apps/backend-mock/utils/jwt-utils.ts` 中的 token 密钥是硬编码的示例值，生产环境必须替换。

前端如需迁移到其他应用，按以下顺序接入：偏好扩展 `tenantMode` → `utils/tenant.ts` 与 `store/tenant.ts` → `tenant-init.ts`（在 `initStores` 之后调用）→ 路由 `base` 与 `router/access.ts` 的路由裁剪 → 请求拦截器 → `authStore` 的登录、`syncTenant`、`switchTenant` → 登录页，以及在 `logo` 插槽中接入 `TenantToggle`。

## 已知限制与后续工作

- **套餐只管控菜单**：套餐决定可见菜单和后端菜单，但没有单独的接口级授权；租户管理员能否调用某个业务接口仍由角色决定。真实后端应同时按套餐校验接口权限。
- **租户内角色是预置的**：每个租户固定有租户管理员和普通成员两个角色，角色列表只读，暂不支持租户自定义角色。
- **业务写操作受演示环境限制**：用户、角色、部门等写接口仍被演示环境拦截，模拟后端只演示了读取时的隔离。
- **部分全局状态未按租户区分**：模拟后端的时区设置是全局的，所有租户共享。
- **子域名模式切换需重新登录**：不同 origin 无法共享登录态。可以通过一次性票据（ticket）在跳转时换取目标租户的 token 来改善。
- **租户列表公开**：未锁定时登录页仍通过 `GET /tenant/list` 获取全部可用租户，会暴露租户名单。对外系统建议使用锁定模式（已改为按编码查询 `/tenant/info`），或改为输入租户编码。
- **多标签页**：未锁定模式下，在一个标签页切换租户会重写 refresh token Cookie，其他标签页的内存状态仍是旧租户。这些标签页在 access token 过期并刷新后，会拿到新租户的 token，但仍发送旧的 `X-Tenant-Id`，从而触发 `403 Tenant mismatch`。后续可通过监听 `storage` 事件或 `BroadcastChannel` 同步切换。
- **切换需要整页刷新**：为保证动态路由、标签页和页面缓存完全重建，切换后整页刷新，体验上有一次白屏。
- **`tenantMode` 存于偏好设置**：便于演示时切换，但会被用户本地偏好覆盖。生产环境更适合由部署配置决定（例如环境变量），并从偏好设置中移除。
- **保留编码两处维护**：前端 `RESERVED_SUBDOMAINS` 与后端 `RESERVED_TENANT_CODES` 需要手动同步，可考虑由后端下发。
- **按租户定制偏好**：目前只同步名称和 Logo，主题色、默认语言等可在 `setTenantInfo` 中扩展。

## 相关文件

| 位置 | 作用 |
| --- | --- |
| `playground/src/preferences.ts` | `tenantMode` 偏好扩展 |
| `playground/src/utils/tenant.ts` | 租户识别、路由 base、目标租户地址、按名称裁剪路由 |
| `playground/src/store/tenant.ts` | 租户状态 |
| `playground/src/tenant-init.ts` | 启动时会话一致性检查 |
| `playground/src/store/auth.ts` | 登录、同步租户、切换租户 |
| `playground/src/router/access.ts` | 按套餐裁剪静态路由 |
| `playground/src/router/routes/modules/tenant.ts` | 「租户管理」目录：租户列表、租户套餐路由（仅 `super`） |
| `playground/src/router/routes/modules/system.ts` | 菜单管理路由（仅 `super`） |
| `playground/src/api/request.ts` | 注入 `X-Tenant-Id` |
| `playground/src/api/core/tenant.ts` | 租户公共接口 |
| `playground/src/api/system/tenant.ts` | 租户管理接口 |
| `playground/src/api/system/tenant-package.ts` | 套餐管理接口 |
| `playground/src/layouts/basic.vue` | 在 Logo 区接入租户切换器 |
| `packages/effects/layouts/src/widgets/tenant-toggle/` | 租户切换器组件 `TenantToggle` |
| `playground/src/views/_core/authentication/login.vue` | 登录页租户选择与品牌 |
| `playground/src/views/tenant/list/` | 租户列表页面 |
| `playground/src/views/tenant/package/` | 套餐管理页面 |
| `playground/__tests__/unit/tenant-resolver.test.ts` | 租户识别单元测试 |
| `apps/backend-mock/utils/jwt-utils.ts` | token 签发与租户上下文解析 |
| `apps/backend-mock/utils/tenant-utils.ts` | 租户访问校验、平台管理员校验、管理接口的入参校验 |
| `apps/backend-mock/utils/tenant-scope.ts` | 套餐菜单计算、成员同步、租户内角色、数据种子 |
| `apps/backend-mock/utils/mock-data.ts` | 账号、租户、成员关系、套餐与菜单目录 |
| `apps/backend-mock/api/tenant/` | 租户公共接口 |
| `apps/backend-mock/api/system/tenant/` | 租户管理接口 |
| `apps/backend-mock/api/system/tenant-package/` | 套餐管理接口 |

## 本地体验

```bash
pnpm dev:play
```

模拟账号的密码均为 `123456`，角色按租户授予：

| 账号    | `default`（平台） | `acme`（Basic） | `nova`（Standard） |
| ------- | ----------------- | --------------- | ------------------ |
| `vben`  | `super`           | `admin`         | `admin`            |
| `admin` | `admin`           | `user`          | —                  |
| `jack`  | `user`            | —               | —                  |

此外还有停用租户 `orbit`（Enterprise）和过期租户 `umbrella`（Standard），用于验证不可用租户不会出现在登录页和切换器中。

- **登录选择**：访问 `http://localhost:5555/`，在登录页选择租户。用 `vben` 登录 `default` 可以看到「租户管理」目录。
- **路径前缀**：访问 `http://localhost:5555/t/acme/`，登录页展示 Acme Corp 的品牌并锁定租户；登录后点击 Logo 区切换到 Nova Tech，无需重新登录。Acme 使用 Basic 套餐，看不到工作台和演示菜单。
- **子域名**：访问 `http://acme.localhost:5555/`（现代浏览器会把 `*.localhost` 解析到本机）。
- **不可用租户**：访问 `http://localhost:5555/t/orbit/`，登录页提示该租户不可用。
