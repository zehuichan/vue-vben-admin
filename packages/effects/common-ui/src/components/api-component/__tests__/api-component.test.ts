import type { PropType } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, markRaw, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import ApiComponent from '../api-component.vue';

type StubOption = { label?: string; value?: number | string };

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: {
    options: { type: Array as PropType<StubOption[]>, default: () => [] },
    value: { type: [String, Number, Array], default: undefined },
  },
  emits: ['update:value'],
  setup(_props, { emit }) {
    return () =>
      h('div', [
        h('button', {
          class: 'pick',
          onClick: () => emit('update:value', 'c2'),
        }),
        h('button', {
          class: 'clear',
          onClick: () => emit('update:value', undefined),
        }),
      ]);
  },
});

const ModelSelectStub = defineComponent({
  name: 'ModelSelectStub',
  props: {
    modelValue: { type: [String, Number, Array], default: undefined },
    options: { type: Array as PropType<StubOption[]>, default: () => [] },
  },
  emits: ['update:modelValue'],
  setup(_props, { emit }) {
    return () =>
      h('button', {
        class: 'pick',
        onClick: () => emit('update:modelValue', 'c2'),
      });
  },
});

const MultiSelectStub = defineComponent({
  name: 'MultiSelectStub',
  props: {
    options: { type: Array as PropType<StubOption[]>, default: () => [] },
    value: {
      type: Array as PropType<Array<number | string>>,
      default: () => [],
    },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h('button', {
        class: 'pick',
        onClick: () => emit('update:value', [...props.value, 'c2']),
      });
  },
});

const ValueInput = defineComponent({
  name: 'ValueInput',
  props: {
    value: { type: String, default: undefined },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        { onClick: () => emit('update:value', 'selected') },
        props.value,
      );
  },
});

const ModelValueInput = defineComponent({
  name: 'ModelValueInput',
  props: {
    modelValue: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        { onClick: () => emit('update:modelValue', 'selected') },
        props.modelValue,
      );
  },
});

const KebabModelInput = defineComponent({
  name: 'KebabModelInput',
  props: {
    modelValue: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        { onClick: () => emit('update:modelValue', 'selected') },
        props.modelValue,
      );
  },
});

describe('api-component.vue', () => {
  it('bridges a custom model prop in both directions', async () => {
    const outerValue = ref('initial');
    const handleUpdate = vi.fn((value: string) => {
      outerValue.value = value;
    });
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            component: markRaw(ValueInput),
            modelPropName: 'value',
            value: outerValue.value,
            'onUpdate:value': handleUpdate,
          });
      },
    });
    const wrapper = mount(Harness);
    const input = wrapper.findComponent(ValueInput);

    expect(input.props('value')).toBe('initial');

    await input.trigger('click');
    await nextTick();
    expect(handleUpdate).toHaveBeenCalledWith('selected');
    expect(input.props('value')).toBe('selected');

    outerValue.value = 'external';
    await nextTick();
    expect(input.props('value')).toBe('external');
  });

  it('preserves the default modelValue protocol', async () => {
    const wrapper = mount(ApiComponent, {
      props: {
        component: markRaw(ModelValueInput),
        modelValue: 'initial',
      },
    });
    const input = wrapper.findComponent(ModelValueInput);

    expect(input.props('modelValue')).toBe('initial');

    await input.trigger('click');
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([['selected']]);
    expect(input.props('modelValue')).toBe('selected');
  });

  it('bridges a kebab-case custom model prop', async () => {
    const outerValue = ref('initial');
    const handleUpdate = vi.fn((value: string) => {
      outerValue.value = value;
    });
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            component: markRaw(KebabModelInput),
            modelPropName: 'model-value',
            'model-value': outerValue.value,
            'onUpdate:model-value': handleUpdate,
          });
      },
    });
    const wrapper = mount(Harness);
    const input = wrapper.findComponent(KebabModelInput);

    expect(input.props('modelValue')).toBe('initial');

    await input.trigger('click');
    await nextTick();
    expect(handleUpdate).toHaveBeenCalledWith('selected');
    expect(input.props('modelValue')).toBe('selected');
  });
});

describe('api-component.vue label model', () => {
  const options: StubOption[] = [
    { label: '客户A', value: 'c1' },
    { label: '客户B', value: 'c2' },
  ];

  function mountLabelHarness(initial: { label?: any; value?: any } = {}) {
    const value = ref(initial.value);
    const label = ref(initial.label);
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            component: markRaw(SelectStub),
            label: label.value,
            modelPropName: 'value',
            'onUpdate:label': (next: any) => {
              label.value = next;
            },
            'onUpdate:value': (next: any) => {
              value.value = next;
            },
            options,
            value: value.value,
          });
      },
    });
    const wrapper = mount(Harness);
    return { label, value, wrapper };
  }

  it('resolves the label from options when a value is selected', async () => {
    const { label, value, wrapper } = mountLabelHarness();

    await wrapper.get('.pick').trigger('click');
    await nextTick();

    expect(value.value).toBe('c2');
    expect(label.value).toBe('客户B');
  });

  it('clears the label together with the value', async () => {
    const { label, value, wrapper } = mountLabelHarness({
      label: '客户A',
      value: 'c1',
    });

    await wrapper.get('.clear').trigger('click');
    await nextTick();

    expect(value.value).toBeUndefined();
    expect(label.value).toBeUndefined();
  });

  it('corrects an outdated label from the loaded options', async () => {
    const { label } = mountLabelHarness({ label: '过期文案', value: 'c1' });
    await nextTick();

    expect(label.value).toBe('客户A');
  });

  it('echoes an unloaded value through a fallback option', async () => {
    const { label, wrapper } = mountLabelHarness({
      label: '历史客户',
      value: 'c99',
    });
    await nextTick();

    // 选项里没有当前值，外部 label 不被覆盖，并补一个兜底选项供界面回显
    expect(label.value).toBe('历史客户');
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual([
      ...options,
      { label: '历史客户', value: 'c99' },
    ]);
  });

  it('matches option values strictly like the wrapped component does', async () => {
    const value = ref(1);
    const label = ref('历史客户');
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            component: markRaw(SelectStub),
            label: label.value,
            modelPropName: 'value',
            numberToString: true,
            'onUpdate:label': (next: any) => {
              label.value = next;
            },
            options: [{ label: '客户A', value: 1 }],
            value: value.value,
          });
      },
    });
    const wrapper = mount(Harness);
    await nextTick();

    // numberToString 后选项值是 '1'，与数字 1 不视为同一项，由兜底选项负责回显
    expect(label.value).toBe('历史客户');
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual([
      { label: '客户A', value: '1' },
      { label: '历史客户', value: 1 },
    ]);
  });

  it('keeps the loaded options identity when no fallback is needed', async () => {
    const { wrapper } = mountLabelHarness();
    const select = wrapper.findComponent(SelectStub);
    const before = select.props('options');

    await wrapper.get('.pick').trigger('click');
    await nextTick();

    expect(select.props('options')).toBe(before);
  });

  it('drops the fallback option once the api returns the real option', async () => {
    const value = ref(3);
    const label = ref('远程客户');
    const api = vi.fn().mockResolvedValue([{ name: '远程客户C', id: 3 }]);
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            api,
            component: markRaw(SelectStub),
            label: label.value,
            labelField: 'name',
            modelPropName: 'value',
            'onUpdate:label': (next: any) => {
              label.value = next;
            },
            valueField: 'id',
            value: value.value,
          });
      },
    });
    const wrapper = mount(Harness);
    const select = wrapper.findComponent(SelectStub);

    expect(select.props('options')).toEqual([{ label: '远程客户', value: 3 }]);

    await flushPromises();
    await nextTick();

    expect(label.value).toBe('远程客户C');
    expect(select.props('options')).toEqual([{ label: '远程客户C', value: 3 }]);
  });

  it('keeps multi-select labels aligned when picking beside an unloaded value', async () => {
    const value = ref<Array<number | string>>(['c99']);
    const label = ref<string[]>(['历史客户']);
    const Harness = defineComponent({
      setup() {
        return () =>
          h(ApiComponent, {
            component: markRaw(MultiSelectStub),
            label: label.value,
            modelPropName: 'value',
            'onUpdate:label': (next: any) => {
              label.value = next;
            },
            'onUpdate:value': (next: any) => {
              value.value = next;
            },
            options,
            value: value.value,
          });
      },
    });
    const wrapper = mount(Harness);
    await nextTick();

    await wrapper.get('.pick').trigger('click');
    await nextTick();

    expect(value.value).toEqual(['c99', 'c2']);
    // 回显的历史值沿用外部文本，新选中的值从选项反查，两者按位置一一对应
    expect(label.value).toEqual(['历史客户', '客户B']);
    expect(wrapper.findComponent(MultiSelectStub).props('options')).toEqual([
      ...options,
      { label: '历史客户', value: 'c99' },
    ]);
  });

  it('keeps the label in sync with the default modelValue protocol', async () => {
    const wrapper = mount(ApiComponent, {
      props: {
        component: markRaw(ModelSelectStub),
        options,
      },
    });

    await wrapper.get('.pick').trigger('click');
    await nextTick();

    expect(wrapper.emitted('update:modelValue')).toEqual([['c2']]);
    expect(wrapper.emitted('update:label')).toEqual([['客户B']]);
  });
});
