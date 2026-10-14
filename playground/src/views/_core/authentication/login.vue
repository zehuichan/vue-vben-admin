<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption, Recordable } from '@vben/types';

import { computed, markRaw, onMounted, ref, useTemplateRef } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getTenantInfoApi, getTenantListApi } from '#/api';
import { useAuthStore, useTenantStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const tenantStore = useTenantStore();

const tenantOptions = ref<BasicOption[]>([]);
/** 访问地址锁定的租户不存在或不可用 */
const lockedTenantUnavailable = ref(false);

const MOCK_USER_OPTIONS: BasicOption[] = [
  {
    label: 'Super',
    value: 'vben',
  },
  {
    label: 'Admin',
    value: 'admin',
  },
  {
    label: 'User',
    value: 'jack',
  },
];

const tenantSchema = computed((): VbenFormSchema[] => {
  if (!tenantStore.enabled) {
    return [];
  }
  return [
    {
      component: 'VbenSelect',
      componentProps: {
        disabled: tenantStore.isLocked,
        options: tenantOptions.value,
        placeholder: $t('page.tenant.selectTenant'),
      },
      fieldName: 'tenantCode',
      label: $t('page.tenant.selectTenant'),
      rules: z
        .string()
        .min(1, { message: $t('page.tenant.selectTenant') })
        .default(tenantStore.tenantCode || 'default'),
    },
  ];
});

const formSchema = computed((): VbenFormSchema[] => {
  return [
    ...tenantSchema.value,
    {
      component: 'VbenSelect',
      // componentProps(_values, form) {
      //   return {
      //     'onUpdate:modelValue': (value: string) => {
      //       const findItem = MOCK_USER_OPTIONS.find(
      //         (item) => item.value === value,
      //       );
      //       if (findItem) {
      //         form.setValues({
      //           password: '123456',
      //           username: findItem.label,
      //         });
      //       }
      //     },
      //     options: MOCK_USER_OPTIONS,
      //     placeholder: $t('authentication.selectAccount'),
      //   };
      // },
      componentProps: {
        options: MOCK_USER_OPTIONS,
        placeholder: $t('authentication.selectAccount'),
      },
      fieldName: 'selectAccount',
      label: $t('authentication.selectAccount'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.selectAccount') })
        .optional()
        .default('vben'),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      dependencies: {
        trigger(values, form) {
          if (values.selectAccount) {
            const findUser = MOCK_USER_OPTIONS.find(
              (item) => item.value === values.selectAccount,
            );
            if (findUser) {
              form.setValues({
                password: '123456',
                username: findUser.value,
              });
            }
          }
        },
        triggerFields: ['selectAccount'],
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: markRaw(SliderCaptcha),
      fieldName: 'captcha',
      rules: z.boolean().refine((value) => value, {
        message: $t('authentication.verifyRequiredTip'),
      }),
    },
  ];
});

const subTitle = computed(() => {
  if (!tenantStore.isLocked) {
    return '';
  }
  if (lockedTenantUnavailable.value) {
    return $t('page.tenant.unavailable', { tenant: tenantStore.tenantCode });
  }
  const tenant =
    tenantOptions.value.find((item) => item.value === tenantStore.tenantCode)
      ?.label ?? tenantStore.tenantCode;
  return $t('page.tenant.lockedHint', { tenant });
});

const loginRef =
  useTemplateRef<InstanceType<typeof AuthenticationLogin>>('loginRef');

async function onSubmit(params: Recordable<any>) {
  authStore.authLogin(params).catch(() => {
    // 登陆失败，刷新验证码的演示
    const formApi = loginRef.value?.getFormApi();
    // 重置验证码组件的值
    formApi?.setFieldValue('captcha', false, false);
    // 使用表单API获取验证码组件实例，并调用其resume方法来重置验证码
    formApi
      ?.getFieldComponentRef<InstanceType<typeof SliderCaptcha>>('captcha')
      ?.resume();
  });
}

/**
 * 访问地址锁定租户时只查询该租户并展示其品牌，避免向外暴露全部租户
 */
async function loadLockedTenant(code: string) {
  try {
    const info = await getTenantInfoApi(code);
    tenantStore.setTenantInfo(info);
    tenantOptions.value = [{ label: info.name, value: info.code }];
  } catch {
    tenantStore.setTenantInfo(null);
    lockedTenantUnavailable.value = true;
  }
}

onMounted(async () => {
  if (!tenantStore.enabled) {
    return;
  }
  if (tenantStore.isLocked && tenantStore.tenantCode) {
    await loadLockedTenant(tenantStore.tenantCode);
    return;
  }
  const list = await getTenantListApi();
  tenantOptions.value = list.map((item) => ({
    label: item.name,
    value: item.code,
  }));
  // 记住的租户可能来自之前访问的锁定地址，或已被停用，不可用时改选第一个可用租户
  const remembered = tenantStore.tenantCode;
  const fallback = list[0]?.code;
  if (fallback && !list.some((item) => item.code === remembered)) {
    tenantStore.setTenantCode(fallback);
    loginRef.value?.getFormApi()?.setFieldValue('tenantCode', fallback);
  }
});
</script>

<template>
  <AuthenticationLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :sub-title="subTitle"
    @submit="onSubmit"
  />
</template>
