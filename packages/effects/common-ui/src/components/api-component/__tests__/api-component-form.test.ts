import type { VueWrapper } from '@vue/test-utils';
import type { PropType } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, markRaw } from 'vue';

import { useVbenForm } from '@vben-core/form-ui';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ApiComponent from '../api-component.vue';

type StubOption = { label?: string; value?: number | string };

const wrappers: VueWrapper[] = [];

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: {
    options: { default: () => [], type: Array as PropType<StubOption[]> },
    value: { default: undefined, type: [String, Number] },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'pick',
          onClick: () => emit('update:value', 'c2'),
          type: 'button',
        },
        props.options.find((option) => option.value === props.value)?.label ??
          props.value,
      );
  },
});

const clients = [
  { clientName: '客户A', id: 'c1' },
  { clientName: '客户B', id: 'c2' },
];

function createForm(
  api: () => Promise<typeof clients>,
  handleValuesChange?: (values: Record<string, any>) => void,
) {
  return useVbenForm({
    handleValuesChange,
    schema: [
      {
        component: markRaw(ApiComponent),
        componentProps: {
          api,
          component: markRaw(SelectStub),
          labelField: 'clientName',
          modelPropName: 'value',
          valueField: 'id',
        },
        fieldName: ['clientId', 'mark'],
        label: '客户',
        // 适配器通过 baseModelPropName / modelPropNameMap 提供，这里显式声明
        modelPropName: 'value',
      },
    ],
  });
}

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.unmount();
  }
  vi.restoreAllMocks();
});

describe('api-component.vue bound to a label + value field pair', () => {
  it('writes both the id and the display text on selection', async () => {
    const [Form, formApi] = createForm(() => Promise.resolve(clients));
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await wrapper.get('.pick').trigger('click');
    await flushPromises();

    expect(await formApi.getValues()).toEqual({
      clientId: 'c2',
      mark: '客户B',
    });
  });

  it('writes both fields within a single change notification', async () => {
    const changes: Record<string, any>[] = [];
    const [Form] = createForm(
      () => Promise.resolve(clients),
      (values) => changes.push({ ...values }),
    );
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();
    changes.length = 0;

    await wrapper.get('.pick').trigger('click');
    await flushPromises();

    // 两个字段必须一起变，不能先抛出 mark 尚未跟上的中间态
    expect(changes).toEqual([{ clientId: 'c2', mark: '客户B' }]);
  });

  it('echoes the text while the options are still loading', async () => {
    let resolveApi: (value: typeof clients) => void = () => {};
    const [Form, formApi] = createForm(
      () =>
        new Promise<typeof clients>((resolve) => {
          resolveApi = resolve;
        }),
    );
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await formApi.setValues({ clientId: 'c1', mark: '客户A' });
    await flushPromises();

    // 选项还没回来，界面已经显示文本而不是裸 id
    expect(wrapper.get('.pick').text()).toBe('客户A');

    resolveApi(clients);
    await flushPromises();

    expect(wrapper.get('.pick').text()).toBe('客户A');
    expect(await formApi.getValues()).toEqual({
      clientId: 'c1',
      mark: '客户A',
    });
  });

  it('refreshes a stale text once the options are loaded', async () => {
    const [Form, formApi] = createForm(() => Promise.resolve(clients));
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await formApi.setValues({ clientId: 'c1', mark: '过期文案' });
    await flushPromises();

    expect(await formApi.getValues()).toEqual({
      clientId: 'c1',
      mark: '客户A',
    });
    expect(wrapper.get('.pick').text()).toBe('客户A');
  });
});
