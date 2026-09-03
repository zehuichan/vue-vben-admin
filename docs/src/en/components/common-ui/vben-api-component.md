---
outline: deep
---

# Vben ApiComponent

`ApiComponent` is a wrapper used to attach remote-option loading behavior to an existing component while preserving the original component usage pattern.

## Common Usage

The current wrapper flow is:

- pass the target component through `component`
- fetch remote data through `api`
- transform data through `beforeFetch` and `afterFetch`
- map remote fields through `resultField`, `valueField`, `labelField`, and `childrenField`
- pass normalized options to the target component through `optionsPropName`

```vue
<script lang="ts" setup>
import { ApiComponent } from '@vben/common-ui';

import { Cascader } from 'antdv-next';

function fetchApi() {
  return Promise.resolve([
    {
      label: 'Zhejiang',
      value: 'zhejiang',
      children: [{ label: 'Hangzhou', value: 'hangzhou' }],
    },
  ]);
}
</script>

<template>
  <ApiComponent
    :api="fetchApi"
    :component="Cascader"
    :immediate="false"
    children-field="children"
    loading-slot="suffixIcon"
    visible-event="onDropdownVisibleChange"
  />
</template>
```

## Binding label and value together

When a control needs to keep both the option id and its display text (value stores the id, label stores the text), `ApiComponent` provides `v-model:label` alongside the primary model:

- picking an option looks the text up in the loaded options and emits `update:label`
- clearing the value clears the label as well
- while the options are still loading (for example when a detail view only returns an id and a text), the incoming label is used as a fallback option so the control renders the text instead of a raw id; once the options arrive, the label is refreshed from them
- for multi-select components the label mirrors the value and is an array as well

```vue
<script lang="ts" setup>
import { ref } from 'vue';

import { ApiComponent } from '@vben/common-ui';

import { Select } from 'antdv-next';

const clientId = ref('C-9999');
const clientName = ref('Archived client');

function fetchClients() {
  return Promise.resolve([{ id: 'C-1001', name: 'Hangzhou Trading Co.' }]);
}
</script>

<template>
  <ApiComponent
    v-model:value="clientId"
    v-model:label="clientName"
    :api="fetchClients"
    :component="Select"
    label-field="name"
    model-prop-name="value"
    value-field="id"
  />
</template>
```

Inside a form there is no need to wire `onUpdate:label` by hand — declare the schema `fieldName` as an array instead, see [binding several fields to one control](./vben-form#binding-several-fields-to-one-control).

## Current Props

| Prop | Description | Type |
| --- | --- | --- |
| `component` | wrapped target component | `Component` |
| `label` (`v-model:label`) | display text of the current value | `any` |
| `api` | remote request function | `(arg?: any) => Promise<any>` |
| `params` | extra request params | `Record<string, any>` |
| `beforeFetch` | hook before request | `AnyPromiseFunction` |
| `afterFetch` | hook after request | `AnyPromiseFunction` |
| `visibleEvent` | event name used to lazy-load data | `string` |
| `loadingSlot` | slot name used to render the loading icon | `string` |
| `modelPropName` | model prop name of the wrapped component | `string` |
| `autoSelect` | auto-pick the first / last / only option, or use a custom function | `'first' \| 'last' \| 'one' \| ((items) => item) \| false` |

## Exposed Methods

| Method                   | Description                            |
| ------------------------ | -------------------------------------- |
| `getComponentRef()`      | returns the wrapped component instance |
| `updateParam(newParams)` | merges and updates request params      |
| `getOptions()`           | returns loaded options                 |
| `getValue()`             | returns the current bound value        |
| `getLabel()`             | returns the display text of the value  |
