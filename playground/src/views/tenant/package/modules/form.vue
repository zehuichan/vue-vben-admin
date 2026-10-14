<script lang="ts" setup>
import type { DataNode } from 'antdv-next/dist/tree';

import type { Recordable } from '@vben/types';

import type { SystemMenuApi } from '#/api/system/menu';
import type { SystemTenantPackageApi } from '#/api/system/tenant-package';

import { computed, nextTick, ref } from 'vue';

import { Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Spin } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { getMenuList } from '#/api/system/menu';
import {
  createTenantPackage,
  updateTenantPackage,
} from '#/api/system/tenant-package';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemTenantPackageApi.SystemTenantPackage>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 'auto' },
  schema: useFormSchema(),
  showDefaultActions: false,
});

const menus = ref<DataNode[]>([]);
const loadingMenus = ref(false);

const [Drawer, drawerApi] =
  useVbenDrawer<null | SystemTenantPackageApi.SystemTenantPackage>({
    async onConfirm() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues();
      const data = {
        ...values,
        menuIds: values.menuIds ?? [],
      } as Omit<SystemTenantPackageApi.SystemTenantPackage, 'id'>;
      const id = formData.value?.id;
      drawerApi.lock();
      (id ? updateTenantPackage(id, data) : createTenantPackage(data))
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
      formApi.reset();
      formData.value = data ?? undefined;

      if (menus.value.length === 0) {
        await loadMenus();
      }
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    },
  });

/**
 * 平台专属菜单（platformOnly）不可分配给租户，不出现在可选树中
 */
function omitPlatformOnly(
  items: SystemMenuApi.SystemMenu[],
): SystemMenuApi.SystemMenu[] {
  return items
    .filter((item) => !item.platformOnly)
    .map((item) =>
      item.children?.length
        ? { ...item, children: omitPlatformOnly(item.children) }
        : item,
    );
}

async function loadMenus() {
  loadingMenus.value = true;
  try {
    const res = await getMenuList();
    menus.value = omitPlatformOnly(res) as unknown as DataNode[];
  } finally {
    loadingMenus.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('tenant.package.name')])
    : $t('ui.actionTitle.create', [$t('tenant.package.name')]);
});

function getNodeClass(node: Recordable<any>) {
  return node.value?.type === 'button' ? 'inline-flex' : '';
}
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #menuIds="slotProps">
        <Spin :spinning="loadingMenus" :classes="{ root: 'w-full' }">
          <Tree
            :tree-data="menus"
            multiple
            bordered
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps.componentProps"
            value-field="id"
            label-field="meta.title"
            icon-field="meta.icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta.icon" :icon="value.meta.icon" />
              {{ $t(value.meta.title) }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
