import type { FormSchemaFieldName } from './types';

import { get, isObject, set } from '@vben-core/shared/utils';

export function deleteValueByFieldName(
  values: Record<string, any>,
  fieldName: string,
) {
  const { pathSegments, rawKey } = resolveFieldNamePath(fieldName);
  if (rawKey) {
    Reflect.deleteProperty(values, rawKey);
    return;
  }

  if (pathSegments.length === 0) {
    Reflect.deleteProperty(values, fieldName);
    return;
  }

  let target: Record<string, any> | undefined = values;
  for (const segment of pathSegments.slice(0, -1)) {
    if (!target || !isObject(target)) {
      return;
    }
    target = target[segment];
  }

  const lastPathSegment = pathSegments.at(-1);
  if (!target || !isObject(target) || !lastPathSegment) {
    return;
  }
  Reflect.deleteProperty(target, lastPathSegment);
}

export function getValueByFieldName(
  values: Record<string, any>,
  fieldName: string,
) {
  const { rawKey } = resolveFieldNamePath(fieldName);
  return rawKey ? values[rawKey] : get(values, fieldName);
}

export function resolveChildUpdateFieldName(
  parentFieldName: string,
  fieldName: string,
) {
  if (fieldName.startsWith(`${parentFieldName}.`)) {
    return fieldName.slice(parentFieldName.length + 1);
  }

  const indexedPrefix = `${parentFieldName}[`;
  if (!fieldName.startsWith(indexedPrefix)) {
    return;
  }

  const closeIndex = fieldName.indexOf(']', indexedPrefix.length);
  if (closeIndex === -1 || fieldName[closeIndex + 1] !== '.') {
    return;
  }
  return fieldName.slice(closeIndex + 2);
}

/**
 * 归一化 schema 的 fieldName：字符串按单字段处理，数组时第 0 项为主字段，
 * 其余为同一个控件上附加模型（默认第 1 项对应 `v-model:label`）绑定的字段。
 */
export function resolveFieldNameList(fieldName: FormSchemaFieldName): string[] {
  if (!Array.isArray(fieldName)) {
    return [fieldName];
  }
  return fieldName.filter(Boolean);
}

export function resolveFieldNamePath(fieldName: string) {
  if (fieldName.startsWith('[') && fieldName.endsWith(']')) {
    const rawKey = fieldName.slice(1, -1);
    return {
      pathSegments: [rawKey],
      rawKey,
    };
  }

  return {
    pathSegments: fieldName.match(/[^.[\]]+/g) ?? [],
    rawKey: undefined,
  };
}

// 每个 schema 都会调用，字符串是绝大多数场景，这里避免分配临时数组
export function resolvePrimaryFieldName(
  fieldName: FormSchemaFieldName,
): string {
  if (!Array.isArray(fieldName)) {
    return fieldName;
  }
  return fieldName.find(Boolean) ?? '';
}

export function resolveValueFormatFieldName(
  fieldName: string,
  parentPath?: string,
) {
  if (!parentPath) {
    return fieldName;
  }
  if (fieldName.startsWith('$root.')) {
    return fieldName.slice('$root.'.length);
  }
  if (fieldName.startsWith('$row.')) {
    return `${parentPath}.${fieldName.slice('$row.'.length)}`;
  }
  if (fieldName === parentPath || fieldName.startsWith(`${parentPath}.`)) {
    return fieldName;
  }
  return `${parentPath}.${fieldName}`;
}

export function setValueByFieldName(
  values: Record<string, any>,
  fieldName: string,
  value: any,
) {
  const { rawKey } = resolveFieldNamePath(fieldName);
  if (rawKey) {
    values[rawKey] = value;
    return;
  }
  set(values, fieldName, value);
}
