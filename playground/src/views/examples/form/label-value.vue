<script lang="ts" setup>
import { ref } from 'vue';

import { ApiComponent, Page } from '@vben/common-ui';

import { useDebounceFn } from '@vueuse/core';
import { Button, Card, message, Select, Space, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';

import DocButton from '../doc-button.vue';

interface Client {
  id: string;
  name: string;
}

interface LabelValueFormValues {
  clientId?: string;
  mark?: string;
  supplierId?: string;
  supplierName?: string;
}

const clients: Client[] = [
  { id: 'C-1001', name: '杭州西湖贸易有限公司' },
  { id: 'C-1002', name: '宁波北仑物流有限公司' },
  { id: 'C-1003', name: '苏州工业园区科技有限公司' },
  { id: 'C-1004', name: '南京江宁建材有限公司' },
];

// 模拟远程接口
function fetchClients(params: Record<string, any> = {}) {
  const keyword = params.keyword as string | undefined;
  return new Promise<Client[]>((resolve) => {
    setTimeout(() => {
      resolve(
        keyword
          ? clients.filter((client) => client.name.includes(keyword))
          : clients,
      );
    }, 300);
  });
}

/** 直接使用 ApiComponent：value 存 id，label 存展示文本 */
const clientId = ref<string | undefined>();
const clientName = ref<string | undefined>();

function echoDeletedClient() {
  // 模拟详情回显：接口只给了 id 和文本，选项里没有这个 id
  clientId.value = 'C-9999';
  clientName.value = '已停用的历史客户';
}

const keyword = ref('');

const submittedValues = ref<LabelValueFormValues>({});
const currentValues = ref<LabelValueFormValues>({});

const [BaseForm, formApi] = useVbenForm<LabelValueFormValues>({
  commonConfig: {
    colon: true,
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 120,
  },
  handleSubmit(values) {
    submittedValues.value = values;
    message.success(`提交值：${JSON.stringify(values)}`);
  },
  handleValuesChange(values) {
    currentValues.value = { ...values };
  },
  schema: [
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: fetchClients,
        labelField: 'name',
        // 默认按 value(id) 过滤，这里要按展示文本搜索
        optionFilterProp: 'label',
        placeholder: '请选择客户',
        showSearch: true,
        valueField: 'id',
      },
      // 第 0 项绑主模型（v-model:value），第 1 项绑 v-model:label
      fieldName: ['clientId', 'mark'],
      help: 'clientId 存 id，mark 存展示文本，选中/清空一起变',
      label: '客户',
      rules: 'selectRequired',
    },
    {
      component: 'ApiSelect',
      componentProps: () => ({
        allowClear: true,
        api: fetchClients,
        // 交给后端搜索，关闭本地过滤
        filterOption: false,
        labelField: 'name',
        onSearch: useDebounceFn((value: string) => {
          keyword.value = value;
        }, 300),
        params: {
          keyword: keyword.value || undefined,
        },
        placeholder: '输入关键字远程搜索',
        shouldFetch: (params: Record<string, any>) => !!params?.keyword,
        showSearch: true,
        valueField: 'id',
      }),
      fieldName: ['supplierId', 'supplierName'],
      help: '远程搜索同样复用 ApiComponent 已有能力',
      label: '供应商',
    },
  ],
  wrapperClass: 'grid-cols-1',
});

async function echoFormValues() {
  // 详情回显：选项里没有 C-9999，界面依然显示文本
  await formApi.setValues({
    clientId: 'C-9999',
    mark: '已停用的历史客户',
  });
  currentValues.value = await formApi.getValues();
}

async function readFormValues() {
  currentValues.value = await formApi.getValues();
  message.info(`当前值：${JSON.stringify(currentValues.value)}`);
}

async function resetForm() {
  await formApi.reset();
  submittedValues.value = {};
  currentValues.value = await formApi.getValues();
}
</script>

<template>
  <Page content-class="flex flex-col gap-4" title="Label + Value 双向绑定">
    <template #description>
      <div class="text-muted-foreground">
        <p>
          一个控件同时维护 id 和展示文本：主模型写 id，
          <code>v-model:label</code>
          写文本。表单里把
          <code>fieldName</code>
          写成数组即可，第 0 项绑主模型，第 1 项绑
          <code>label</code>
          。选项未加载时，已有的文本会作为兜底选项回显，界面不会出现裸 id。
        </p>
      </div>
    </template>
    <template #extra>
      <DocButton class="mb-2" path="/components/common-ui/vben-api-component" />
    </template>

    <Card title="1. 直接使用 ApiComponent">
      <template #extra>
        <Button @click="echoDeletedClient">模拟详情回显</Button>
      </template>
      <div class="flex max-w-md flex-col gap-3">
        <ApiComponent
          v-model:value="clientId"
          v-model:label="clientName"
          :api="fetchClients"
          :component="Select"
          allow-clear
          label-field="name"
          loading-slot="suffixIcon"
          model-prop-name="value"
          option-filter-prop="label"
          placeholder="请选择客户"
          show-search
          value-field="id"
          visible-event="onOpenChange"
        />
        <Space wrap>
          <Tag color="blue">value(id)：{{ clientId ?? '-' }}</Tag>
          <Tag color="green">label(文本)：{{ clientName ?? '-' }}</Tag>
        </Space>
      </div>
    </Card>

    <Card title="2. 表单使用 fieldName: ['clientId', 'mark']">
      <template #extra>
        <Space wrap>
          <Button @click="echoFormValues">setValues 回显</Button>
          <Button @click="readFormValues">获取表单值</Button>
          <Button @click="resetForm">重置</Button>
        </Space>
      </template>
      <div class="max-w-2xl">
        <BaseForm />
      </div>
      <div class="mt-2 flex flex-col gap-1 text-sm">
        <span>当前值：{{ JSON.stringify(currentValues) }}</span>
        <span>提交值：{{ JSON.stringify(submittedValues) }}</span>
      </div>
    </Card>
  </Page>
</template>
