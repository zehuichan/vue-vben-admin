---
outline: deep
---

# Multi-Tenancy

This is the design document for multi-tenancy in `playground`. It covers how tenants are identified, how the tenant context travels between frontend and backend, how roles, menus and data are isolated per tenant, how the platform manages tenants through packages, and what a real backend must implement.

::: tip Scope

The implementation lives in `playground` (frontend) and `apps/backend-mock` (mock backend). Other apps (`web-antd`, `web-ele`, etc.) don't include it. To adopt it in your own app, follow this document and the [related files](#related-files).

:::

## Goals

- **One account, many tenants**: accounts are global and join tenants through memberships, and **an account can hold a different role in each tenant**.
- **Platform and tenants are separated**: only platform administrators in the platform tenant can manage tenants and packages; tenant administrators only manage users, roles and departments of their own tenant.
- **Packages decide features**: the menus a tenant can use come from its package, and package changes take effect without touching roles.
- **Several identification methods**: subdomain (`acme.example.com`), path prefix (`/t/acme/`) or selection on the login page, switchable per deployment, or turned off entirely.
- **The backend is the source of truth**: the tenant context is signed into the token and roles are resolved on every request. The frontend only carries and displays it, and cannot escalate by tampering with request headers.
- **Immediate revocation**: once a tenant is disabled or expires, or a user is removed or has their role changed, issued tokens follow the new state right away.
- **Minimal intrusion**: no changes to the `@vben/*` core packages. Everything plugs in at the app level through a preference extension, a store, the request interceptor, route generation and a layout slot.

**Non-goals**: database isolation strategy (shared tables with `tenant_id`, schema per tenant or database per tenant) is up to the backend. Per-tenant theme, language and other preferences are also out of scope; only the app name and logo follow the tenant.

## Concepts

| Concept | Description |
| --- | --- |
| Tenant | The unit of isolation, identified by a unique **tenant code** (`code`), e.g. `acme`. |
| Tenant code | Used in the `X-Tenant-Id` header, the subdomain and the path prefix, so it **cannot be changed after creation**. |
| Account | A global login (username and password). It carries no role by itself. |
| Membership | `account + tenant + roles`. Only members can sign in to a tenant, and the roles only apply inside it. |
| Platform tenant | The built-in tenant `default`. It cannot be deleted, disabled or expired, has no package and can use every menu. |
| Platform administrator | A member of the platform tenant with role `super`, the only identity that can manage tenants and packages. `super` can only be granted in the platform tenant. |
| Tenant administrator | A member with role `admin` in a tenant; manages that tenant's users, roles and departments. Every regular tenant has at least one. |
| Member | A member with role `user`. |
| Package | A set of menu IDs that decides which menus a regular tenant can use. |
| Platform-only menu | A menu marked `platformOnly` (menu management, plus the "Tenant Management" catalog with its tenant list and tenant package pages). No package can include it. |
| Available tenant | A tenant that is enabled (`status = 1`) and not expired (`expireTime` empty or not before today). |
| Tenant context | The tenant a request belongs to, taken from the `tenantCode` claim of the access token. |
| Locked | The tenant is decided by the URL (subdomain or path prefix). The tenant selector on the login page is then read-only. |

## Architecture

```text
[Browser]
  URL (subdomain / /t/:code/)
      │  utils/tenant.ts resolves the tenant
      ▼
  tenantStore: enabled / lockedBy / tenantCode / tenantInfo / tenantList / hiddenMenus
      ▲
      │  login / syncTenant / switchTenant
  authStore ◄── login page (queries /tenant/info for the brand when locked) / logo-area switcher
      │
      ├──► router/access.ts: static routes trimmed by hiddenMenus, then filtered by role
      ▼
  request.ts interceptor
      Authorization: Bearer <token with tenantCode in the payload>
      X-Tenant-Id: <tenantCode>
      │
──────┼──────────────────────────────────────────────
      ▼
[Backend]
  getTenantContext / verifyTenantAccess
      1. Verify the access token
      2. X-Tenant-Id matches tenantCode in the token
      3. Look up the membership to get the roles in this tenant
      4. The tenant is available (enabled and not expired)
      │
      ├──► Menus = role menus ∩ package menus
      ├──► Access codes from the roles in this tenant
      ├──► Business data isolated per tenant (users, roles, departments, tables, ...)
      └──► Platform APIs additionally require: platform tenant + super (verifyPlatformAdmin)
```

## Tenant Identification

### Modes

The mode is set through the preference extension field `tenantMode` (defined in `playground/src/preferences.ts`) and can be changed in the business preferences tab of the preferences drawer. **Reload the page** for a change to take effect.

| Mode | How the tenant is identified | Locked | Use case |
| --- | --- | --- | --- |
| `auto` (default) | Subdomain > path prefix > login selection | When a subdomain or path matches | One codebase, several deployments |
| `subdomain` | Subdomain only | Yes | A domain per tenant |
| `path` | Path prefix `/t/:code/` only | Yes | One domain, no wildcard DNS |
| `select` | Login selection and logo-area switcher | No | Internal systems where users pick the tenant |
| `single` | Multi-tenancy off | — | Single-tenant systems: no tenant UI and no `X-Tenant-Id` |

### Subdomain rules

`resolveTenantFromHostname` takes the first label of the hostname as the tenant code, except when:

- the hostname is `localhost` or an IPv4 address;
- there are too few labels: `*.localhost` needs at least 2 (`acme.localhost`), other domains at least 3 (`acme.example.com`);
- the first label is reserved: `admin`, `api`, `app`, `localhost`, `www`.

::: warning Keep reserved codes in sync

`RESERVED_SUBDOMAINS` on the frontend (`playground/src/utils/tenant.ts`) and `RESERVED_TENANT_CODES` on the backend (`apps/backend-mock/utils/mock-data.ts`) must match. The backend rejects reserved codes so no tenant ends up unreachable by subdomain.

:::

### Path prefix and router base

In path mode the tenant code is part of the URL, e.g. `/t/acme/dashboard`. To keep the route table unaware of the prefix, `getTenantRouterBase` sets the router `base` to `${VITE_BASE}t/acme/`, so guards and menus still see `/dashboard`. This also works with a non-root `VITE_BASE` (e.g. `/app/t/acme/`) and with hash history.

The result is cached in the module so route creation (at module load) and `initTenant` (at startup) see the same value. `initPreferences` runs before `bootstrap` is imported, so `tenantMode` is already available when the router module loads.

## Tenant Context

### Carried twice: token claim and request header

- **Token claim (authoritative)**: on login, tenant switch and token refresh, the backend writes `tenantCode` into the access and refresh token payloads. The backend only trusts the tenant in the token.
- **`X-Tenant-Id` header (consistency check)**: the interceptor adds it when multi-tenancy is on and a `tenantCode` exists. If the header and the claim disagree, the backend returns `403 Tenant mismatch`.

The header cannot switch tenants. It exists to surface mismatches between frontend state and the token early (tampered local state, tabs out of sync) instead of silently returning another tenant's data.

Roles are **not stored in the token**. Every request looks up the membership for `username + tenantCode`, so role changes and removals take effect immediately without reissuing tokens.

### Frontend state

`useTenantStore` (`playground/src/store/tenant.ts`) holds:

| Field | Description | Persisted |
| --- | --- | --- |
| `enabled` | `tenantMode !== 'single'` | No, recomputed at startup |
| `lockedBy` | Lock source: `subdomain` / `path` / `null` | No |
| `tenantCode` | Current tenant code | Yes |
| `tenantInfo` | Current tenant name and logo, synced to `preferences.app.name` and `preferences.logo.source` | Yes |
| `tenantList` | Tenants the user can switch to | No, from the user info API |
| `hiddenMenus` | Route names outside the current tenant's package | No, from the user info API |

`$reset` (called by `resetAllStores` on logout) clears session fields but runs `resolveTenant` again, so a tenant locked by the URL stays locked on the login page.

### Session consistency

In subdomain mode every tenant is a separate origin, so `localStorage` is isolated. In path mode all tenants share one origin: local storage may hold a token for tenant A while the user opens `/t/b/`. `initTenant` (`playground/src/tenant-init.ts`) handles this at startup:

```text
startup → read the stored tenantCode → resolve the tenant from the URL
        → an accessToken exists and they differ → resetAllStores(), back to login
```

Switching tenants from the logo-area switcher in path mode first obtains the target tenant's token and stores the new `tenantCode`, then navigates, so it doesn't trigger this reset (see [Switching tenants](#switching-tenants)).

## Key Flows

### Login

1. With multi-tenancy on, the login page picks its data source depending on the lock:
   - **Locked**: calls `GET /tenant/info?code=<code>` for that tenant only, applies its name and logo to the login page (`setTenantInfo`), disables the selector and shows "Tenant is locked by URL" as the subtitle. If the tenant doesn't exist, is disabled or has expired, the API returns 404, the subtitle says so and the default brand is restored.
   - **Not locked**: calls `GET /tenant/list` to fill the selector. If the remembered tenant (for example from a locked URL visited earlier, or a tenant that was disabled since) isn't in the list, the first available tenant is selected instead.
2. On submit, `authLogin` fills a missing `tenantCode` from `tenantStore.tenantCode`.
3. The backend checks credentials → picks the tenant (request body > the user's first available tenant > `default`) → checks membership → checks availability → issues tokens carrying `tenantCode`.
4. The frontend stores the token and the returned `tenantCode`, then fetches user info and access codes in parallel.
5. User info returns `tenantCode`, the `roles` in the current tenant, `tenants` (switchable tenants), `hiddenMenus` and a `homePath` corrected for the package. `syncTenant` updates `tenantStore` from them.

### Switching tenants

The tenant switcher lives in the logo area and uses `TenantToggle` from `@vben/layouts`. `basic.vue` renders it through the `logo` slot of `BasicLayout` and passes in the tenant list and the current tenant code. The logo and name already show the current tenant's brand. When the user has at least one tenant, clicking the logo area opens the tenant list, and picking one calls `authStore.switchTenant`:

| Situation | Behavior | Re-login |
| --- | --- | --- |
| Not locked | Calls `POST /tenant/switch` for a new token (the backend also rewrites the refresh token cookie), updates `tenantCode` and access codes, then goes home with a full reload | No |
| Locked by path | Also obtains the new token and updates `tenantCode`, access codes and brand, waits for persistence, then navigates to `/t/:code/` | No |
| Locked by subdomain | Navigates to the target subdomain. Sessions can't be shared across origins, so the user signs in there | Yes |

The full reload rebuilds dynamic menus, routes and page caches for the new tenant.

### Token refresh

`POST /auth/refresh` reuses the `tenantCode` from the refresh token. It checks membership and availability again before signing, and returns 403 if either fails; the frontend then asks the user to sign in.

### Revocation

After a tenant is disabled or expires, or a user is removed, `getTenantContext` returns 401 on the next request. `authenticateResponseInterceptor` tries a refresh first, which fails for the same reason, and then follows `loginExpiredMode` (login modal or redirect).

## Permission Model

### Roles are granted per tenant

Roles belong to memberships, not accounts. The same account can be platform administrator in the platform tenant, tenant administrator in tenant A and a plain member in tenant B:

| Role | Grantable in | Capabilities |
| --- | --- | --- |
| `super` platform administrator | Platform tenant only | All menus; manages tenants, packages and menus |
| `admin` tenant administrator | Any tenant | Users, roles and departments of the tenant, plus other menus in the package |
| `user` member | Any tenant | Basic menus such as dashboard, demos, project and about (also limited by the package) |

Access codes (`/auth/codes`) and backend menus (`/menu/all`) come from the roles in the current tenant. Static frontend routes are filtered by `meta.authority`; the "Tenant Management" catalog and menu management use `authority: ['super']`.

### Separating platform and tenants

Tenant and package management APIs go through `verifyPlatformAdmin`: **the current tenant is the platform tenant and the role there is `super`**. As a result:

- an `admin` in the platform tenant cannot manage tenants;
- a platform administrator who switched into a regular tenant cannot manage tenants there and must switch back;
- platform APIs are not filtered by the current tenant and see every tenant.

### Packages and menu trimming

A regular tenant's usable menus are computed from its package (`getTenantMenuCatalog`):

1. take the package's `menuIds`;
2. keep a parent while any child is granted;
3. always drop platform-only menus.

Menu names outside that set form `hiddenMenus`. How each [access mode](./access.md) applies it:

| Access mode | Where menus are trimmed |
| --- | --- |
| `backend` | `/menu/all` returns `role menus ∩ package menus` |
| `frontend` | `router/access.ts` removes static routes listed in `hiddenMenus`, then filters by role |
| `mixed` | Both of the above, then merged by route name |

The platform tenant's `hiddenMenus` is empty. Packages only govern menus registered in the menu catalog (`MOCK_MENU_LIST`); static routes outside it (such as `playground`'s Examples) are not affected.

If the user's home page is hidden by the package, the user info API falls back to `/dashboard/analytics` so login doesn't land on a 404.

## Data Isolation

Every API that needs the tenant context gets the user, tenant and roles through `verifyTenantAccess` and returns data for that tenant:

| API | Isolation |
| --- | --- |
| `system/user/list` | Regular tenants get their own members and their roles in that tenant; the platform tenant gets every account with the tenants it belongs to |
| `system/role/list` | Role definitions in the tenant (the platform tenant also has Platform Administrator); permissions are intersected with the tenant's menus |
| `system/menu/list` | The tenant's menu catalog, used for role permissions |
| `system/dept/list` | Departments per tenant |
| `table/list` | Table rows per tenant |
| Other authenticated APIs (department writes, menu checks, upload, timezone, ...) | Check the tenant context; rejected on `X-Tenant-Id` mismatch or an unavailable tenant |

The mock backend seeds department and table data with the tenant code, so each tenant always sees the same data and tenants see different data.

## Tenant Management

Platform features live in a top-level "Tenant Management" catalog, separate from the in-tenant "System" catalog (users, roles, departments), and are visible to platform administrators only:

- "Tenant Management → Tenant List" (`/tenant/list`, page `playground/src/views/tenant/list`)
- "Tenant Management → Tenant Package" (`/tenant/package`, page `playground/src/views/tenant/package`)

### Tenant model

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Primary key |
| `code` | `string` | Tenant code, immutable after creation |
| `name` | `string` | Tenant name, required, up to 50 characters |
| `packageId` | `string` | Package ID, required for regular tenants; empty string for the platform tenant |
| `logo` | `string` | Logo URL, generated when empty |
| `status` | `0 \| 1` | Disabled / enabled |
| `expireTime` | `string` | `YYYY-MM-DD`; empty string means never expires |
| `members` | `string[]` | Member usernames, stored as memberships |
| `admins` | `string[]` | Members with role `admin`, a subset of `members`; platform tenant roles are not changed through this field |
| `contactName` / `contactPhone` / `remark` | `string` | Contact name, phone, remark |
| `createTime` | `string` | Creation time |
| `available` / `expired` / `packageName` | — | Computed by the list API, read-only |

### Creating a tenant with its administrator

Creating a tenant requires a package and an administrator account (`adminUsername`):

- if the account exists, it joins the new tenant as tenant administrator;
- otherwise a new account is created with `adminPassword` (at least 6 characters) and joins the tenant;
- other accounts in `members` join as plain members.

The new tenant can be signed in to and managed right away, without further setup by the platform administrator.

### Validation and protection

- **Code format**: 2–32 lowercase letters, digits or hyphens, starting with a letter and not ending with a hyphen (`/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/`); not reserved; globally unique. Checked by both the form and the backend.
- **Immutable code**: the code is in tokens, URLs and subdomains, so changing it would invalidate all of them. The update API ignores `code`.
- **At least one administrator**: when editing a regular tenant, `admins` cannot be empty and only keeps accounts still in `members`. Editing the platform tenant's members keeps existing roles, and new members join as plain members.
- **Protected tenants**: the platform tenant `default` and the tenant the operator is signed in to cannot be deleted, disabled or set to expired, so operators can't lock themselves out.
- **Cannot remove yourself**: when editing the members of your current tenant, you cannot remove yourself.
- **Deleting a tenant** removes all its memberships; the accounts themselves remain.

### Package model and rules

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Primary key |
| `name` | `string` | Package name, required and unique |
| `menuIds` | `number[]` | Included menu IDs (catalogs, menus and buttons) |
| `status` | `0 \| 1` | Disabled / enabled |
| `remark` / `createTime` | `string` | Remark, creation time |
| `tenantCount` | `number` | Number of tenants on the package, read-only |

- Platform-only menus are stripped on save, and the menu tree in the form doesn't show them.
- A disabled package can't be assigned to more tenants; tenants already on it are unaffected.
- A package still in use can't be deleted.
- After a package or a tenant's package changes, APIs use the new package on the next request; frontend routes are rebuilt at the next login or page reload.

::: info Demo write lock

By default the mock backend blocks writes under `/api/system/*` with "demo environment, modification forbidden". Tenant and package data drive login, switching and isolation in the demo, so the `/api/system/tenant` prefix (which includes `/api/system/tenant-package`) is whitelisted in `apps/backend-mock/middleware/1.api.ts`. Data lives in memory and resets when the server restarts.

:::

## API Contract

| API | Auth | Notes |
| --- | --- | --- |
| `POST /auth/login` | None | Optional `tenantCode` in the body; the response adds `tenantCode` and omits the password |
| `POST /auth/refresh` | Refresh token cookie | Reuses the tenant in the refresh token and re-checks it |
| `GET /user/info` | Tenant context | Adds `tenantCode`, `roles` (in the current tenant), `tenants` and `hiddenMenus`; `homePath` is corrected for the package |
| `GET /auth/codes` | Tenant context | Access codes for the roles in the current tenant |
| `GET /menu/all` | Tenant context | Role menus intersected with package menus |
| `GET /tenant/info?code=` | None | For locked login pages; returns only that tenant's `code`, `name` and `logo`; 404 if missing or unavailable |
| `GET /tenant/list` | None | For unlocked login pages; `code`, `name` and `logo` of available tenants |
| `GET /tenant/current` | Tenant context | Current tenant |
| `POST /tenant/switch` | Access token | Body `{ tenantCode }`; returns `{ accessToken, tenantCode, tenant }` and rewrites the refresh token cookie |
| `GET /system/tenant/list` | Platform administrator | Paged; filters `name`, `code`, `status`, `startTime`, `endTime` |
| `GET /system/tenant/member-options` | Platform administrator | Assignable accounts |
| `GET /system/tenant/code-exists` | Platform administrator | Params `code`, `id` (excluded when editing) |
| `POST /system/tenant` | Platform administrator | Create a tenant; `packageId` and `adminUsername` required, `adminPassword` for new accounts |
| `PUT /system/tenant/:id` | Platform administrator | Partial update, `code` ignored; supports `packageId`, `members`, `admins` |
| `DELETE /system/tenant/:id` | Platform administrator | Delete a tenant and its memberships |
| `GET /system/tenant-package/list` | Platform administrator | Paged; filters `name`, `status` |
| `GET /system/tenant-package/options` | Platform administrator | Package options for the tenant form; disabled packages carry `disabled` |
| `POST /system/tenant-package` | Platform administrator | Create a package |
| `PUT /system/tenant-package/:id` | Platform administrator | Update a package |
| `DELETE /system/tenant-package/:id` | Platform administrator | Delete an unused package |

"Tenant context" means: a valid access token, `X-Tenant-Id` (if present) matches the token, the user is a member of the tenant, and the tenant is available. "Platform administrator" adds: the current tenant is the platform tenant and the role is `super`. CORS must allow `X-Tenant-Id` in `Access-Control-Allow-Headers`.

### Error semantics

| Case | Status | Frontend behavior |
| --- | --- | --- |
| User is not a member of the tenant at login | 403 | Error message, stays on login |
| Tenant disabled/expired at login or switch | 403 | Error message |
| Locked tenant missing or unavailable | 404 (`/tenant/info`) | Login page subtitle |
| `X-Tenant-Id` differs from the token | 403 `Tenant mismatch` | Error message, no automatic logout |
| User removed, or tenant disabled/expired | 401 | Tries a refresh, then asks to sign in |
| Non-platform administrator calls tenant or package APIs | 403 | Error message |
| Creating/editing a tenant without a package or administrator, or with a disabled package | 400 | Error message |

## Integrating a Real Backend

The mock backend only demonstrates the contract. A real backend needs to:

1. **Carry the tenant in tokens**: every token issued on login, switch and refresh includes `tenantCode`. Read the tenant only from the token, never directly from headers or parameters.
2. **Check every request**: `X-Tenant-Id` matches the token, the membership is valid, the tenant is available, and roles come from the membership. Membership and tenant status may be cached, but disabling, removing and role changes must invalidate the cache, otherwise revocation isn't immediate.
3. **Filter business data**: every query and write carries the current tenant (or switches to the tenant's schema/data source). Inject this in the ORM/data access layer rather than by hand in each endpoint.
4. **Bind refresh tokens to tenants**: reissue the refresh token on tenant switch and invalidate the old one.
5. **Separate platform and tenant capabilities**: platform APIs such as tenants and packages only accept platform roles in the platform tenant and are not filtered by the current tenant.
6. **Enforce packages on the backend**: menus, access codes and API permissions should all be trimmed by the package. `hiddenMenus` on the frontend is for display only and does not replace API authorization.
7. **Initialize tenants**: create the administrator membership (and default roles, departments and other tenant data) in the same transaction as the tenant.
8. **Replace the secrets**: the token secrets in `apps/backend-mock/utils/jwt-utils.ts` are hard-coded examples and must be replaced in production.

To port the frontend to another app, wire things up in this order: the `tenantMode` preference extension → `utils/tenant.ts` and `store/tenant.ts` → `tenant-init.ts` (called after `initStores`) → router `base` and route trimming in `router/access.ts` → request interceptor → `authStore` login, `syncTenant` and `switchTenant` → login page, plus `TenantToggle` in the `logo` slot.

## Known Limitations and Future Work

- **Packages only govern menus**: packages decide visible menus and backend menus, but there's no separate API-level check; whether a tenant administrator can call a business API still depends on the role. A real backend should also check API permissions against the package.
- **Tenant roles are predefined**: every tenant has exactly a tenant administrator and a member role, the role list is read-only, and custom roles per tenant aren't supported yet.
- **Business writes are blocked by the demo lock**: writes to users, roles, departments and so on are still rejected by the demo environment, so the mock only shows isolation on reads.
- **Some global state isn't per tenant**: the mock's timezone setting is global and shared by all tenants.
- **Switching in subdomain mode requires signing in again**: sessions can't be shared across origins. A one-time ticket exchanged for the target tenant's token during the redirect could improve this.
- **Public tenant list**: unlocked login pages still call `GET /tenant/list`, which exposes the list of tenants. For public-facing systems use a locked mode (which now queries `/tenant/info` by code) or ask users to type the tenant code.
- **Multiple tabs**: in unlocked mode, switching tenants in one tab rewrites the refresh token cookie while other tabs keep the old tenant in memory. When their access token expires and is refreshed, they get a token for the new tenant but still send the old `X-Tenant-Id`, which triggers `403 Tenant mismatch`. A `storage` event listener or `BroadcastChannel` could sync the switch.
- **Switching reloads the page**: to fully rebuild dynamic routes, tabs and page caches, a switch reloads the page, which causes a brief blank screen.
- **`tenantMode` lives in preferences**: convenient for the demo, but user preferences can override it. In production it belongs in deployment config (e.g. an environment variable) and should be removed from the preferences UI.
- **Reserved codes maintained twice**: `RESERVED_SUBDOMAINS` and `RESERVED_TENANT_CODES` must be kept in sync by hand; the backend could serve them instead.
- **Per-tenant preferences**: only the name and logo follow the tenant; theme color, default language and so on can be added in `setTenantInfo`.

## Related Files

| Location | Purpose |
| --- | --- |
| `playground/src/preferences.ts` | `tenantMode` preference extension |
| `playground/src/utils/tenant.ts` | Tenant resolution, router base, target tenant URL, trimming routes by name |
| `playground/src/store/tenant.ts` | Tenant state |
| `playground/src/tenant-init.ts` | Session consistency check at startup |
| `playground/src/store/auth.ts` | Login, tenant sync, tenant switch |
| `playground/src/router/access.ts` | Trims static routes by package |
| `playground/src/router/routes/modules/tenant.ts` | "Tenant Management" catalog: tenant list and tenant package routes (`super` only) |
| `playground/src/router/routes/modules/system.ts` | Menu management route (`super` only) |
| `playground/src/api/request.ts` | Adds `X-Tenant-Id` |
| `playground/src/api/core/tenant.ts` | Public tenant APIs |
| `playground/src/api/system/tenant.ts` | Tenant management APIs |
| `playground/src/api/system/tenant-package.ts` | Package management APIs |
| `playground/src/layouts/basic.vue` | Wires up the tenant switcher in the logo area |
| `packages/effects/layouts/src/widgets/tenant-toggle/` | Tenant switcher component `TenantToggle` |
| `playground/src/views/_core/authentication/login.vue` | Tenant selection and brand on the login page |
| `playground/src/views/tenant/list/` | Tenant list page |
| `playground/src/views/tenant/package/` | Package management page |
| `playground/__tests__/unit/tenant-resolver.test.ts` | Tenant resolution unit tests |
| `apps/backend-mock/utils/jwt-utils.ts` | Token signing and tenant context |
| `apps/backend-mock/utils/tenant-utils.ts` | Tenant access check, platform administrator check, payload validation |
| `apps/backend-mock/utils/tenant-scope.ts` | Package menus, member sync, tenant roles, data seeds |
| `apps/backend-mock/utils/mock-data.ts` | Accounts, tenants, memberships, packages and the menu catalog |
| `apps/backend-mock/api/tenant/` | Public tenant APIs |
| `apps/backend-mock/api/system/tenant/` | Tenant management APIs |
| `apps/backend-mock/api/system/tenant-package/` | Package management APIs |

## Try It Locally

```bash
pnpm dev:play
```

All mock accounts use the password `123456`. Roles are granted per tenant:

| Account | `default` (platform) | `acme` (Basic) | `nova` (Standard) |
| ------- | -------------------- | -------------- | ----------------- |
| `vben`  | `super`              | `admin`        | `admin`           |
| `admin` | `admin`              | `user`         | —                 |
| `jack`  | `user`               | —              | —                 |

There are also a disabled tenant `orbit` (Enterprise) and an expired tenant `umbrella` (Standard) to verify that unavailable tenants don't show up on the login page or in the switcher.

- **Login selection**: open `http://localhost:5555/` and pick a tenant. Sign in to `default` as `vben` to see the "Tenant Management" catalog.
- **Path prefix**: open `http://localhost:5555/t/acme/`. The login page shows Acme Corp's brand and locks the tenant; after signing in, switch to Nova Tech from the logo area without signing in again. Acme is on the Basic package, so it has no Workspace or Demos menu.
- **Subdomain**: open `http://acme.localhost:5555/` (modern browsers resolve `*.localhost` to the local machine).
- **Unavailable tenant**: open `http://localhost:5555/t/orbit/`; the login page says the tenant is unavailable.
