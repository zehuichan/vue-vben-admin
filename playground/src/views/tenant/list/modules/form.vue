<script lang="ts" setup>
import type { SystemTenantApi } from '#/api/system/tenant';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/system/tenant';
import { $t } from '#/locales';
import { useTenantStore } from '#/store';

import { PLATFORM_TENANT_CODE, useFormSchema } from '../data';

const emits = defineEmits(['success']);

const tenantStore = useTenantStore();

const formData = ref<SystemTenantApi.SystemTenant>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 'auto' },
  schema: useFormSchema(() => formData.value),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemTenantApi.SystemTenant>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values =
      (await formApi.getValues()) as Partial<SystemTenantApi.CreateTenantParams>;
    const members: string[] = values.members ?? [];
    // 清空日期时组件给出 null/undefined，需显式传空串才能在编辑时清除过期时间
    const data = {
      ...values,
      admins: values.admins?.filter((name: string) => members.includes(name)),
      expireTime: values.expireTime ?? '',
      members,
    } as SystemTenantApi.CreateTenantParams;
    const id = formData.value?.id;
    drawerApi.lock();
    (id ? updateTenant(id, data) : createTenant(data))
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData();
    formData.value = data ?? undefined;
    formApi.reset();

    formApi.updateSchema([
      { componentProps: { disabled: !!data }, fieldName: 'code' },
      {
        componentProps: {
          disabled:
            data?.code === PLATFORM_TENANT_CODE ||
            (!!data && data.code === tenantStore.tenantCode),
        },
        fieldName: 'status',
      },
    ]);

    // Wait for Vue to flush DOM updates (form fields mounted)
    await nextTick();
    if (data) {
      formApi.setValues(data);
    }
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('tenant.list.name')])
    : $t('ui.actionTitle.create', [$t('tenant.list.name')]);
});
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
