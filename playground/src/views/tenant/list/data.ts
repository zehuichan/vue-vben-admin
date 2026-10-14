import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemTenantApi } from '#/api';

import { z } from '#/adapter/form';
import {
  getTenantMemberOptions,
  getTenantPackageOptions,
  isTenantCodeExists,
} from '#/api';
import { $t } from '#/locales';
import { RESERVED_SUBDOMAINS } from '#/utils/tenant';

/** 平台内置租户，不可删除、停用或设置过期 */
export const PLATFORM_TENANT_CODE = 'default';

/** 2-32 位小写字母、数字或连字符，字母开头，不能以连字符结尾 */
const TENANT_CODE_PATTERN = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

/** 与后端一致：3-32 位小写字母、数字、下划线或连字符，字母开头 */
const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,31}$/;

const statusOptions = () => [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

/**
 * @param getTenant 编辑中的租户，新建时为空；用于编码唯一性校验与区分新建/编辑字段
 */
export function useFormSchema(
  getTenant: () => SystemTenantApi.SystemTenant | undefined,
): VbenFormSchema[] {
  const isCreate = () => !getTenant();
  const isPlatform = () => getTenant()?.code === PLATFORM_TENANT_CODE;
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('tenant.list.tenantName'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('tenant.list.tenantName')]))
        .max(
          50,
          $t('ui.formRules.maxLength', [$t('tenant.list.tenantName'), 50]),
        ),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'acme',
      },
      fieldName: 'code',
      help: $t('tenant.list.codeHelp'),
      label: $t('tenant.list.code'),
      rules: z
        .string()
        .regex(TENANT_CODE_PATTERN, $t('tenant.list.codeRule'))
        .refine((value) => !RESERVED_SUBDOMAINS.has(value), {
          error: (issue) =>
            $t('tenant.list.codeReserved', [String(issue.input)]),
        })
        .refine(
          async (value: string) => {
            return !(await isTenantCodeExists(value, getTenant()?.id));
          },
          {
            error: (issue) =>
              $t('ui.formRules.alreadyExists', [
                $t('tenant.list.code'),
                issue.input,
              ]),
          },
        ),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('tenant.list.status'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: getTenantPackageOptions,
        class: 'w-full',
      },
      dependencies: {
        if: () => !isPlatform(),
        triggerFields: ['code'],
      },
      fieldName: 'packageId',
      help: $t('tenant.list.packageHelp'),
      label: $t('tenant.list.package'),
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: {
        autocomplete: 'off',
      },
      dependencies: {
        if: isCreate,
        triggerFields: ['code'],
      },
      fieldName: 'adminUsername',
      help: $t('tenant.list.adminUsernameHelp'),
      label: $t('tenant.list.adminUsername'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('tenant.list.adminUsername')]))
        .regex(USERNAME_PATTERN, $t('tenant.list.adminUsernameRule')),
    },
    {
      component: 'InputPassword',
      componentProps: {
        autocomplete: 'new-password',
      },
      dependencies: {
        if: isCreate,
        triggerFields: ['code'],
      },
      fieldName: 'adminPassword',
      help: $t('tenant.list.adminPasswordHelp'),
      label: $t('tenant.list.adminPassword'),
      rules: z
        .union([
          z.literal(''),
          z
            .string()
            .min(
              6,
              $t('ui.formRules.minLength', [
                $t('tenant.list.adminPassword'),
                6,
              ]),
            ),
        ])
        .optional(),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getTenantMemberOptions,
        class: 'w-full',
        mode: 'multiple',
      },
      defaultValue: [],
      fieldName: 'members',
      help: $t('tenant.list.membersHelp'),
      label: $t('tenant.list.members'),
    },
    {
      component: 'Select',
      dependencies: {
        componentProps: (values) => ({
          class: 'w-full',
          mode: 'multiple',
          options: ((values.members as string[] | undefined) ?? []).map(
            (name) => ({ label: name, value: name }),
          ),
        }),
        if: () => !isCreate() && !isPlatform(),
        triggerFields: ['code', 'members'],
      },
      defaultValue: [],
      fieldName: 'admins',
      help: $t('tenant.list.adminsHelp'),
      label: $t('tenant.list.admins'),
      rules: z
        .array(z.string())
        .min(1, $t('ui.formRules.selectRequired', [$t('tenant.list.admins')])),
    },
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        placeholder: $t('tenant.list.neverExpire'),
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'expireTime',
      help: $t('tenant.list.expireTimeHelp'),
      label: $t('tenant.list.expireTime'),
    },
    {
      component: 'Input',
      fieldName: 'contactName',
      label: $t('tenant.list.contactName'),
    },
    {
      component: 'Input',
      fieldName: 'contactPhone',
      label: $t('tenant.list.contactPhone'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'https://',
      },
      fieldName: 'logo',
      help: $t('tenant.list.logoHelp'),
      label: $t('tenant.list.logo'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('tenant.list.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('tenant.list.tenantName'),
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('tenant.list.code'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions(),
      },
      fieldName: 'status',
      label: $t('tenant.list.status'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('tenant.list.createTime'),
    },
  ];
}

export function useColumns<T = SystemTenantApi.SystemTenant>(
  onActionClick: OnActionClickFn<T>,
  isProtected: (row: T) => boolean,
): VxeTableGridColumns {
  return [
    {
      cellRender: {
        name: 'CellImage',
        props: { height: 28, preview: false, width: 28 },
      },
      field: 'logo',
      title: $t('tenant.list.logo'),
      width: 70,
    },
    {
      field: 'name',
      minWidth: 200,
      slots: { default: 'name' },
      title: $t('tenant.list.tenantName'),
    },
    {
      field: 'code',
      title: $t('tenant.list.code'),
      width: 120,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('tenant.list.status'),
      width: 130,
    },
    {
      field: 'expireTime',
      slots: { default: 'expireTime' },
      title: $t('tenant.list.expireTime'),
      width: 170,
    },
    {
      field: 'packageName',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('tenant.list.package'),
      width: 120,
    },
    {
      field: 'members',
      minWidth: 200,
      slots: { default: 'members' },
      title: $t('tenant.list.members'),
    },
    {
      field: 'contactName',
      title: $t('tenant.list.contactName'),
      width: 130,
    },
    {
      field: 'contactPhone',
      title: $t('tenant.list.contactPhone'),
      width: 130,
    },
    {
      field: 'createTime',
      title: $t('tenant.list.createTime'),
      width: 170,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('tenant.list.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', { code: 'delete', disabled: isProtected }],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('tenant.list.operation'),
      width: 130,
    },
  ];
}
