<script lang="ts" setup>
import type {
  ApiComponentProps,
  ApiComponentOptionsItem as OptionsItem,
} from './types';

import { computed, nextTick, ref, unref, useAttrs, watch } from 'vue';

import { LoaderCircle } from '@vben/icons';

import {
  cloneDeep,
  get,
  isEmpty,
  isEqual,
  isFunction,
  traverseTreeValues,
} from '@vben-core/shared/utils';

import { objectOmit } from '@vueuse/core';

defineOptions({ name: 'ApiComponent', inheritAttrs: false });

const props = withDefaults(defineProps<ApiComponentProps>(), {
  labelField: 'label',
  valueField: 'value',
  labelFn: undefined,
  disabledField: 'disabled',
  childrenField: '',
  optionsPropName: 'options',
  resultField: '',
  visibleEvent: '',
  numberToString: false,
  params: () => ({}),
  immediate: true,
  alwaysLoad: false,
  loadingSlot: '',
  beforeFetch: undefined,
  shouldFetch: undefined,
  afterFetch: undefined,
  modelPropName: 'modelValue',
  api: undefined,
  autoSelect: false,
  options: () => [],
});

const emit = defineEmits<{
  optionsChange: [OptionsItem[]];
}>();

const modelValue = defineModel<any>({ default: undefined });
/**
 * 当前值对应的展示文本。value 存 id、label 存文本，两者一起变更。
 * 选项未加载时（例如详情回显），外部传入的 label 会作为兜底选项显示。
 */
const label = defineModel<any>('label', { default: undefined });

const attrs = useAttrs();
const usesDefaultModelValue = computed(() => {
  return ['model-value', 'modelValue'].includes(props.modelPropName);
});
const modelUpdateEvent = computed(() => `onUpdate:${props.modelPropName}`);
/**
 * defineModel 只能接管默认的 modelValue，
 * modelPropName 被改写时读写都要落到 attrs 上。
 */
const currentModelValue = computed<any>({
  get() {
    return usesDefaultModelValue.value
      ? modelValue.value
      : attrs[props.modelPropName];
  },
  set(value) {
    if (usesDefaultModelValue.value) {
      modelValue.value = value;
      return;
    }
    const updateHandler = attrs[unref(modelUpdateEvent)];
    if (isFunction(updateHandler)) {
      updateHandler(value);
    }
  },
});
const innerParams = ref({});
const refOptions = ref<OptionsItem[]>([]);
const loading = ref(false);
// 首次是否加载过了
const isFirstLoaded = ref(false);
// 标记是否有待处理的请求
const hasPendingRequest = ref(false);

const loadedOptions = computed(() => {
  const {
    labelField,
    labelFn,
    valueField,
    disabledField,
    childrenField,
    numberToString,
  } = props;

  function transformData(data: OptionsItem[] = []): OptionsItem[] {
    return data.map((item) => {
      const value = get(item, valueField);
      const children = childrenField ? get(item, childrenField) : item.children;
      return {
        ...objectOmit(item, [
          labelField,
          valueField,
          disabledField,
          ...(childrenField ? [childrenField] : []),
        ]),
        label: labelFn ? labelFn(item) : get(item, labelField),
        value: numberToString ? `${value}` : value,
        disabled: get(item, disabledField),
        ...(Array.isArray(children) && children.length > 0
          ? { children: transformData(children) }
          : {}),
      };
    });
  }

  const data = transformData(unref(refOptions));

  return data.length > 0 ? data : transformData(props.options);
});

// 分组/树形选项时，反查文本需要连同子节点一起展开
const flatOptions = computed(() => {
  return traverseTreeValues<OptionsItem, OptionsItem>(
    unref(loadedOptions),
    (item) => item,
  );
});

function toValueList(value: any): any[] {
  if (isEmpty(value)) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

// 与被包装组件保持一致的严格匹配：类型不一致（如 numberToString）时走兜底选项回显
function findOptionLabel(value: any) {
  return unref(flatOptions).find((item) => item.value === value)?.label;
}

/**
 * 外部传入的 value 与 label 的配对。多选时两者都是数组、按位置一一对应，
 * 这里按 value 建索引，后续反查不再依赖下标，混合了新旧值时也不会错位。
 */
const labelByValue = computed(() => {
  const labels = toValueList(unref(label));
  const pairs = new Map<any, any>();
  toValueList(unref(currentModelValue)).forEach((value, index) => {
    if (!isEmpty(labels[index])) {
      pairs.set(value, labels[index]);
    }
  });
  return pairs;
});

// 优先取已加载选项里的文本；选项尚未覆盖当前值时沿用外部传入的 label
function resolveLabel(value: any) {
  return findOptionLabel(value) ?? unref(labelByValue).get(value);
}

/**
 * 选项尚未覆盖当前值时（例如详情回显先拿到 id 和文本、选项还在请求中），
 * 用外部传入的 label 补一个兜底选项，避免界面显示裸 id。
 */
const fallbackOptions = computed(() => {
  return toValueList(unref(currentModelValue)).flatMap<OptionsItem>((value) => {
    if (findOptionLabel(value) !== undefined) {
      return [];
    }
    const fallbackLabel = unref(labelByValue).get(value);
    return isEmpty(fallbackLabel) ? [] : [{ label: `${fallbackLabel}`, value }];
  });
});

const getOptions = computed(() => {
  const fallback = unref(fallbackOptions);
  // 没有兜底选项时沿用原数组，避免每次选中都给被包装组件一份新的 options
  return fallback.length > 0
    ? [...unref(loadedOptions), ...fallback]
    : unref(loadedOptions);
});

const bindProps = computed(() => {
  const updateEvent = unref(modelUpdateEvent);
  return {
    [props.modelPropName]: unref(currentModelValue),
    [props.optionsPropName]: unref(getOptions),
    [updateEvent]: updateModelValue,
    ...objectOmit(attrs, [props.modelPropName, updateEvent]),
    ...(props.visibleEvent
      ? {
          [props.visibleEvent]: handleFetchForVisible,
        }
      : {}),
  };
});

/**
 * label 要和 value 在同一个 tick 内写出去，
 * 否则表单会先收到一次 label 尚未跟上的中间态。
 */
function updateModelValue(value: any) {
  syncLabelWithValue(value);
  currentModelValue.value = value;
}

function updateLabel(nextLabel: any) {
  if (isEqual(unref(label), nextLabel)) {
    return;
  }
  label.value = nextLabel;
}

/**
 * 按当前值逐项解析展示文本并整体写回，保证 label 始终与 value 一一对应。
 * 选项还没覆盖某个值时沿用它原有的 label，由 fallbackOptions 负责回显。
 */
function syncLabelWithValue(value: any) {
  if (isEmpty(value)) {
    updateLabel(undefined);
    return;
  }
  const labels = toValueList(value).map((item) => resolveLabel(item));
  updateLabel(Array.isArray(value) ? labels : labels[0]);
}

watch(
  [flatOptions, currentModelValue],
  ([, value], previous) => {
    if (!isEmpty(value)) {
      syncLabelWithValue(value);
      return;
    }
    // 值被外部清空时 label 一起清空；初始就为空则保留外部传入的 label
    if (!isEmpty(previous?.[1])) {
      updateLabel(undefined);
    }
  },
  { immediate: true },
);

async function fetchApi() {
  const { api, beforeFetch, shouldFetch, afterFetch, resultField } = props;

  if (!api || !isFunction(api)) {
    return;
  }

  // 如果正在加载，标记有待处理的请求并返回
  if (loading.value) {
    hasPendingRequest.value = true;
    return;
  }

  refOptions.value = [];
  try {
    loading.value = true;
    let finalParams = unref(mergedParams);
    if (beforeFetch && isFunction(beforeFetch)) {
      finalParams = (await beforeFetch(cloneDeep(finalParams))) || finalParams;
    }
    // 判断是否需要控制执行中断
    if (
      shouldFetch &&
      isFunction(shouldFetch) &&
      !(await shouldFetch(finalParams))
    ) {
      return;
    }
    let res = await api(finalParams);
    if (afterFetch && isFunction(afterFetch)) {
      res = (await afterFetch(res)) || res;
    }
    isFirstLoaded.value = true;
    if (Array.isArray(res)) {
      refOptions.value = res;
      emitChange();
      return;
    }
    if (resultField) {
      refOptions.value = get(res, resultField) || [];
    }
    emitChange();
  } catch (error) {
    console.warn(error);
    // reset status
    isFirstLoaded.value = false;
  } finally {
    loading.value = false;
    // 如果有待处理的请求，立即触发新的请求
    if (hasPendingRequest.value) {
      hasPendingRequest.value = false;
      // 使用 nextTick 确保状态更新完成后再触发新请求
      await nextTick();
      fetchApi();
    }
  }
}

async function handleFetchForVisible(visible: boolean) {
  if (visible) {
    if (props.alwaysLoad) {
      await fetchApi();
    } else if (!props.immediate && !unref(isFirstLoaded)) {
      await fetchApi();
    }
  }
}

const mergedParams = computed(() => {
  return {
    ...props.params,
    ...unref(innerParams),
  };
});

watch(
  mergedParams,
  (value, oldValue) => {
    if (isEqual(value, oldValue)) {
      return;
    }
    fetchApi();
  },
  { deep: true, immediate: props.immediate },
);

// 兜底选项只服务于界面回显，自动选择与 optionsChange 只看真正加载到的选项
function emitChange() {
  const options = unref(loadedOptions);
  if (
    currentModelValue.value === undefined &&
    props.autoSelect &&
    options.length > 0
  ) {
    let firstOption;
    if (isFunction(props.autoSelect)) {
      firstOption = props.autoSelect(options);
    } else {
      switch (props.autoSelect) {
        case 'first': {
          firstOption = options[0];
          break;
        }
        case 'last': {
          firstOption = options[options.length - 1];
          break;
        }
        case 'one': {
          if (options.length === 1) {
            firstOption = options[0];
          }
          break;
        }
      }
    }

    if (firstOption) updateModelValue(firstOption.value);
  }
  emit('optionsChange', options);
}
const componentRef = ref();
defineExpose({
  /** 获取已加载的options数据 */
  getOptions: () => unref(loadedOptions),
  /** 获取当前值 */
  getValue: () => unref(currentModelValue),
  /** 获取当前值对应的展示文本 */
  getLabel: () => unref(label),
  /** 获取被包装的组件实例 */
  getComponentRef: <T = any>() => componentRef.value as T,
  /** 更新Api参数 */
  updateParam(newParams: Record<string, any>) {
    innerParams.value = newParams;
  },
});
</script>
<template>
  <component
    :is="component"
    v-bind="bindProps"
    :placeholder="$attrs.placeholder"
    ref="componentRef"
  >
    <template v-for="item in Object.keys($slots)" #[item]="data">
      <slot :name="item" v-bind="data || {}"></slot>
    </template>
    <template v-if="loadingSlot && loading" #[loadingSlot]>
      <LoaderCircle class="animate-spin" />
    </template>
  </component>
</template>
