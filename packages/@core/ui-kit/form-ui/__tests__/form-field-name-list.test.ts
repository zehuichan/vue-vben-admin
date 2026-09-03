import type { VueWrapper } from '@vue/test-utils';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { setupVbenForm } from '../src/config';
import { useVbenForm } from '../src/use-vben-form';

const wrappers: VueWrapper[] = [];

/**
 * 模拟 ApiComponent：value 存 id、label 存展示文本，另加一个第三模型用于覆盖
 * modelPropName 数组的场景。
 */
const DualModelSelect = defineComponent({
  name: 'DualModelSelect',
  props: {
    extra: { default: undefined, type: String },
    label: { default: undefined, type: String },
    value: { default: undefined, type: String },
  },
  emits: ['update:value', 'update:label', 'update:extra'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'pick',
          onClick: () => {
            emit('update:value', 'c2');
            emit('update:label', '客户B');
            emit('update:extra', 'extra-2');
          },
          type: 'button',
        },
        props.label ?? props.value ?? '',
      );
  },
});

beforeAll(() => {
  setupVbenForm({
    config: {},
    rules: {
      required(value, _params, context) {
        return value ? true : `${context.label} is required`;
      },
    },
  });
});

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.unmount();
  }
  vi.restoreAllMocks();
});

describe('schema fieldName as a list', () => {
  it('binds the second field name to the label model by default', async () => {
    const [Form, formApi] = useVbenForm({
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark'],
          label: '客户',
          modelPropName: 'value',
        },
      ],
    });
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

  it('keeps every declared field name when setValues filters by schema', async () => {
    const [Form, formApi] = useVbenForm({
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark'],
          label: '客户',
          modelPropName: 'value',
        },
      ],
    });
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await formApi.setValues({ clientId: 'c9', mark: '历史客户' });
    await flushPromises();

    const select = wrapper.findComponent(DualModelSelect);
    expect(select.props('value')).toBe('c9');
    expect(select.props('label')).toBe('历史客户');
    // 选项里没有 c9 时，界面显示回填的文本而不是裸 id
    expect(select.text()).toBe('历史客户');
    expect(await formApi.getValues()).toEqual({
      clientId: 'c9',
      mark: '历史客户',
    });
  });

  it('reports every declared field name as a changed field', async () => {
    const handleValuesChange = vi.fn();
    const [Form, formApi] = useVbenForm({
      handleValuesChange,
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark'],
          label: '客户',
          modelPropName: 'value',
        },
      ],
    });
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await formApi.setValues({ mark: '历史客户' });
    await flushPromises();

    expect(handleValuesChange).toHaveBeenCalled();
    expect(handleValuesChange.mock.calls.at(-1)?.[1]).toContain('mark');
  });

  it('binds a third model through the modelPropName list', async () => {
    const [Form, formApi] = useVbenForm({
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark', 'clientCode'],
          label: '客户',
          modelPropName: ['value', 'label', 'extra'],
        },
      ],
    });
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    await wrapper.get('.pick').trigger('click');
    await flushPromises();

    expect(await formApi.getValues()).toEqual({
      clientCode: 'extra-2',
      clientId: 'c2',
      mark: '客户B',
    });
  });

  it('uses the first field name for validation, errors and the component ref', async () => {
    const [Form, formApi] = useVbenForm({
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark'],
          label: '客户',
          modelPropName: 'value',
          rules: 'required',
        },
      ],
    });
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();

    const result = await formApi.validate();
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(['clientId']);
    expect(formApi.getFieldComponentRef('clientId')).toBeDefined();

    await wrapper.get('.pick').trigger('click');
    await flushPromises();
    const nextResult = await formApi.validate();
    expect(nextResult.valid).toBe(true);
  });

  it('exposes the extra model inside the field slot componentProps', async () => {
    let slotProps: Record<string, any> | undefined;
    const [Form, formApi] = useVbenForm({
      schema: [
        {
          component: DualModelSelect,
          fieldName: ['clientId', 'mark'],
          label: '客户',
          modelPropName: 'value',
        },
      ],
    });
    const wrapper = mount(Form, {
      slots: {
        clientId(props: Record<string, any>) {
          slotProps = props;
          return h(DualModelSelect, props.componentProps);
        },
      },
    });
    wrappers.push(wrapper);
    await flushPromises();

    await formApi.setValues({ clientId: 'c9', mark: '历史客户' });
    await flushPromises();

    expect(slotProps?.name).toBe('clientId');
    expect(slotProps?.componentProps.label).toBe('历史客户');
    expect(slotProps?.componentProps).toHaveProperty('onUpdate:label');

    await wrapper.get('.pick').trigger('click');
    await flushPromises();
    expect(await formApi.getValues()).toEqual({
      clientId: 'c2',
      mark: '客户B',
    });
  });
});
