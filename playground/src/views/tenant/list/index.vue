<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemTenantApi } from '#/api';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, message, Modal, Switch, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteTenant, getTenantList, updateTenant } from '#/api';
import { $t } from '#/locales';
import { useAuthStore, useTenantStore } from '#/store';
import { createDateRangeCodec } from '#/utils/date-range-codec';

import { PLATFORM_TENANT_CODE, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

interface TenantSearchFormValues extends Record<string, unknown> {
  createTime?: [Dayjs, Dayjs];
}

const tenantSearchCodec = createDateRangeCodec<TenantSearchFormValues>()({
  endField: 'endTime',
  rangeField: 'createTime',
  startField: 'startTime',
});

type TenantSearchSubmitValues = ReturnType<typeof tenantSearchCodec.encode>;

const authStore = useAuthStore();
const tenantStore = useTenantStore();

const statusLoadingIds = ref(new Set<string>());

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    codec: tenantSearchCodec,
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, isProtected),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: TenantSearchSubmitValues) => {
          return await getTenantList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemTenantApi.SystemTenant>,
});

function isPlatformTenant(row: SystemTenantApi.SystemTenant) {
  return row.code === PLATFORM_TENANT_CODE;
}

function isCurrentTenant(row: SystemTenantApi.SystemTenant) {
  return row.code === tenantStore.tenantCode;
}

/**
 * 平台租户与当前登录租户必须保持可用，不允许删除或停用
 */
function isProtected(row: SystemTenantApi.SystemTenant) {
  return isPlatformTenant(row) || isCurrentTenant(row);
}

function onActionClick(e: OnActionClickParams<SystemTenantApi.SystemTenant>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 确认后提交状态变更，成功后才更新行数据
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 */
async function onStatusChange(
  newStatus: 0 | 1,
  row: SystemTenantApi.SystemTenant,
) {
  if (newStatus === 0 && isProtected(row)) {
    message.warning($t('tenant.list.protectedTip'));
    return;
  }
  const statusText =
    newStatus === 1 ? $t('common.enabled') : $t('common.disabled');
  statusLoadingIds.value.add(row.id);
  try {
    await confirm(
      $t('tenant.list.statusConfirm', [row.name, statusText]),
      $t('tenant.list.statusConfirmTitle'),
    );
    await updateTenant(row.id, { status: newStatus });
    row.status = newStatus;
    void syncCurrentUserTenants();
  } catch {
    // 取消确认或请求失败时保持原状态
  } finally {
    statusLoadingIds.value.delete(row.id);
  }
}

function onEdit(row: SystemTenantApi.SystemTenant) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemTenantApi.SystemTenant) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteTenant(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

/**
 * 租户的名称、logo、状态或成员变化后，刷新顶栏租户切换器与品牌信息
 */
async function syncCurrentUserTenants() {
  if (!tenantStore.enabled) {
    return;
  }
  try {
    await authStore.fetchUserInfo();
  } catch {
    // 当前租户不可用时由接口统一提示
  }
}

function onRefresh() {
  gridApi.query();
  void syncCurrentUserTenants();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('tenant.list.title')">
      <template #toolbar-actions>
        <Alert
          v-if="!tenantStore.enabled"
          :title="$t('tenant.list.singleModeTip')"
          banner
          class="ml-2"
          type="warning"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('tenant.list.name')]) }}
        </Button>
      </template>
      <template #name="{ row }">
        <span>{{ row.name }}</span>
        <Tag v-if="isPlatformTenant(row)" class="ml-2" color="blue">
          {{ $t('tenant.list.builtIn') }}
        </Tag>
        <Tag v-if="isCurrentTenant(row)" class="ml-2" color="processing">
          {{ $t('tenant.list.current') }}
        </Tag>
      </template>
      <template #status="{ row }">
        <Switch
          :checked="row.status"
          :checked-children="$t('common.enabled')"
          :checked-value="1"
          :loading="statusLoadingIds.has(row.id)"
          :un-checked-children="$t('common.disabled')"
          :un-checked-value="0"
          @update:checked="(value) => onStatusChange(value as 0 | 1, row)"
        />
      </template>
      <template #expireTime="{ row }">
        <Tag v-if="row.expired" color="error">
          {{ $t('tenant.list.expired') }} {{ row.expireTime }}
        </Tag>
        <span v-else-if="row.expireTime">{{ row.expireTime }}</span>
        <span v-else class="text-foreground/50">
          {{ $t('tenant.list.neverExpire') }}
        </span>
      </template>
      <template #members="{ row }">
        <Tag
          v-for="member in row.members"
          :key="member"
          :color="row.admins?.includes(member) ? 'gold' : undefined"
          :title="row.admins?.includes(member) ? $t('tenant.list.admins') : ''"
        >
          {{ member }}
        </Tag>
        <span v-if="row.members.length === 0" class="text-foreground/50">
          -
        </span>
      </template>
    </Grid>
  </Page>
</template>
