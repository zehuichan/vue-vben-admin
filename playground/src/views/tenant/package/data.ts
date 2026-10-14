import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemTenantPackageApi } from '#/api';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

const statusOptions = () => [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('tenant.package.packageName'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('tenant.package.packageName')]))
        .max(
          30,
          $t('ui.formRules.maxLength', [$t('tenant.package.packageName'), 30]),
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
      help: $t('tenant.package.statusHelp'),
      label: $t('tenant.package.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('tenant.package.remark'),
    },
    {
      component: 'Input',
      defaultValue: [],
      fieldName: 'menuIds',
      formItemClass: 'items-start',
      help: $t('tenant.package.menusHelp'),
      label: $t('tenant.package.menus'),
      modelPropName: 'modelValue',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('tenant.package.packageName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions(),
      },
      fieldName: 'status',
      label: $t('tenant.package.status'),
    },
  ];
}

export function useColumns<T = SystemTenantPackageApi.SystemTenantPackage>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
  isInUse: (row: T) => boolean,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      minWidth: 160,
      title: $t('tenant.package.packageName'),
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: 'CellSwitch',
      },
      field: 'status',
      title: $t('tenant.package.status'),
      width: 100,
    },
    {
      field: 'tenantCount',
      title: $t('tenant.package.tenantCount'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 200,
      title: $t('tenant.package.remark'),
    },
    {
      field: 'createTime',
      title: $t('tenant.package.createTime'),
      width: 170,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('tenant.package.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', { code: 'delete', disabled: isInUse }],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('tenant.package.operation'),
      width: 130,
    },
  ];
}
