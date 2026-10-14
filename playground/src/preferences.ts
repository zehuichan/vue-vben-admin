import {
  appCopyrightPreferences,
  defineOverridesPreferences,
  definePreferencesExtension,
} from '@vben/preferences';

export type TenantMode = 'auto' | 'path' | 'select' | 'single' | 'subdomain';

interface PlaygroundPreferencesExtension {
  defaultVisibleRows: number;
  enableQuickActions: boolean;
  highlightTone: 'default' | 'success' | 'warning';
  reportTitle: string;
  tenantMode: TenantMode;
}

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
  },
  copyright: appCopyrightPreferences,
});

export type { PlaygroundPreferencesExtension };

export const preferencesExtension =
  definePreferencesExtension<PlaygroundPreferencesExtension>({
    tabLabel: 'demos.preferencesExtensionConfig.tabLabel',
    title: 'demos.preferencesExtensionConfig.title',
    fields: [
      {
        component: 'input',
        defaultValue: '',
        key: 'reportTitle',
        label: 'demos.preferencesExtensionConfig.fields.reportTitle.label',
        placeholder:
          'demos.preferencesExtensionConfig.fields.reportTitle.placeholder',
      },
      {
        component: 'number',
        componentProps: {
          max: 8,
          min: 1,
          step: 1,
        },
        defaultValue: 4,
        key: 'defaultVisibleRows',
        label:
          'demos.preferencesExtensionConfig.fields.defaultVisibleRows.label',
        tip: 'demos.preferencesExtensionConfig.fields.defaultVisibleRows.tip',
      },
      {
        component: 'switch',
        defaultValue: true,
        key: 'enableQuickActions',
        label:
          'demos.preferencesExtensionConfig.fields.enableQuickActions.label',
      },
      {
        component: 'select',
        defaultValue: 'default',
        key: 'highlightTone',
        label: 'demos.preferencesExtensionConfig.fields.highlightTone.label',
        options: [
          {
            label:
              'demos.preferencesExtensionConfig.fields.highlightTone.options.default',
            value: 'default',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.highlightTone.options.success',
            value: 'success',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.highlightTone.options.warning',
            value: 'warning',
          },
        ],
      },
      {
        component: 'select',
        defaultValue: 'auto',
        key: 'tenantMode',
        label: 'demos.preferencesExtensionConfig.fields.tenantMode.label',
        tip: 'demos.preferencesExtensionConfig.fields.tenantMode.tip',
        options: [
          {
            label:
              'demos.preferencesExtensionConfig.fields.tenantMode.options.auto',
            value: 'auto',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.tenantMode.options.subdomain',
            value: 'subdomain',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.tenantMode.options.path',
            value: 'path',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.tenantMode.options.select',
            value: 'select',
          },
          {
            label:
              'demos.preferencesExtensionConfig.fields.tenantMode.options.single',
            value: 'single',
          },
        ],
      },
    ],
  });
