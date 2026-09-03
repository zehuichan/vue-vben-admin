import type {
  BaseFormComponentType,
  FormActions,
  FormCommonConfig,
  FormDependenciesResolveContext,
  FormFieldProps,
  FormItemDependencies,
  FormItemDependenciesLegacy,
  FormSchema,
  FormSchemaContext,
  FormSchemaFieldName,
  MaybeComponentProps,
} from '../types';

import {
  get,
  isFunction,
  mergeWithArrayOverride,
} from '@vben-core/shared/utils';

import {
  resolveChildUpdateFieldName,
  resolveFieldNameList,
  resolvePrimaryFieldName,
} from '../field-name';

type AnyFormSchema = FormSchema<BaseFormComponentType, Record<string, any>>;

export type NormalizedFormFieldSchema = FormFieldProps & {
  commonComponentProps: MaybeComponentProps;
  fieldNames: string[];
  formFieldProps: Record<string, any>;
  formItemClass: string;
};

interface CreateFormFieldSchemaOptions {
  commonConfig?: FormCommonConfig;
  disabled?: boolean;
  forceHideLabel?: boolean;
  globalCommonConfig?: FormCommonConfig;
  hidden?: boolean;
}

interface CreateArrayChildSchemaOptions extends CreateFormFieldSchemaOptions {
  arrayField: string;
  index: number;
}

function createSchemaContext(
  baseContext: FormSchemaContext,
  values?: Partial<Record<string, any>>,
): FormSchemaContext {
  const rootValues = values as Record<string, any> | undefined;
  return {
    ...baseContext,
    rootValues,
    row:
      baseContext.rowPath && rootValues
        ? get(rootValues, baseContext.rowPath)
        : undefined,
  };
}

function scopeRowFieldName(rowPath: string, fieldName: string) {
  if (!fieldName) {
    return fieldName;
  }

  if (fieldName.startsWith('$root.')) {
    return fieldName.slice('$root.'.length);
  }

  if (fieldName.startsWith('$row.')) {
    return `${rowPath}.${fieldName.slice('$row.'.length)}`;
  }

  if (fieldName === rowPath || fieldName.startsWith(`${rowPath}.`)) {
    return fieldName;
  }

  return `${rowPath}.${fieldName}`;
}

function wrapComponentProps(
  componentProps: AnyFormSchema['componentProps'],
  baseContext: FormSchemaContext,
) {
  if (!isFunction(componentProps)) {
    return componentProps;
  }

  return () => componentProps(baseContext);
}

function wrapCommonConfig(
  commonConfig: FormCommonConfig | undefined,
  baseContext: FormSchemaContext,
) {
  if (!commonConfig || !isFunction(commonConfig.componentProps)) {
    return commonConfig;
  }

  return {
    ...commonConfig,
    componentProps: wrapComponentProps(
      commonConfig.componentProps,
      baseContext,
    ),
  };
}

function wrapCustomParamsRender(
  render: AnyFormSchema['help'],
  baseContext: FormSchemaContext,
) {
  if (!isFunction(render)) {
    return render;
  }

  return () => render(baseContext);
}

function wrapRenderComponentContent(
  render: AnyFormSchema['renderComponentContent'],
  baseContext: FormSchemaContext,
) {
  if (!isFunction(render)) {
    return render;
  }

  return () => render(baseContext);
}

function wrapDependencyFn<T>(handler: T, baseContext: FormSchemaContext): T {
  if (!isFunction(handler)) {
    return handler;
  }

  return ((
    values: Partial<Record<string, any>>,
    actions: FormActions,
    controller: any,
  ) =>
    handler(
      values,
      actions,
      controller,
      createSchemaContext(baseContext, values),
    )) as T;
}

function scopeDependencies(
  dependencies: FormItemDependencies | undefined,
  baseContext: FormSchemaContext,
): FormItemDependencies | undefined {
  if (!dependencies) {
    return dependencies;
  }

  const rowPath = baseContext.rowPath;
  if (!rowPath) {
    return dependencies;
  }

  const triggerFields =
    dependencies.triggerFields?.map((fieldName) =>
      scopeRowFieldName(rowPath, fieldName),
    ) ?? [];
  if (isFunction(dependencies.resolve)) {
    const resolve = dependencies.resolve;
    return {
      resolve(context: FormDependenciesResolveContext) {
        return resolve({
          ...context,
          schema: createSchemaContext(
            baseContext,
            context.values as Partial<Record<string, any>>,
          ),
        });
      },
      triggerFields,
    };
  }

  const legacyDependencies = dependencies as FormItemDependenciesLegacy;

  return {
    ...legacyDependencies,
    componentProps: wrapDependencyFn(
      legacyDependencies.componentProps,
      baseContext,
    ),
    disabled: wrapDependencyFn(legacyDependencies.disabled, baseContext),
    if: wrapDependencyFn(legacyDependencies.if, baseContext),
    required: wrapDependencyFn(legacyDependencies.required, baseContext),
    rules: wrapDependencyFn(legacyDependencies.rules, baseContext),
    show: wrapDependencyFn(legacyDependencies.show, baseContext),
    trigger: wrapDependencyFn(legacyDependencies.trigger, baseContext),
    triggerFields,
  };
}

function createArrayComponentProps(
  schema: AnyFormSchema,
  options: CreateFormFieldSchemaOptions,
) {
  const componentProps = schema.componentProps;
  const arrayProps = 'arrayProps' in schema ? schema.arrayProps : undefined;
  const children = getFormArraySchemaChildren(schema);
  const commonConfig = options.commonConfig;
  const globalCommonConfig = options.globalCommonConfig;
  const schemaProps = children.length > 0 ? { schema: children } : {};

  if (isFunction(componentProps)) {
    return () => ({
      ...arrayProps,
      ...componentProps({
        fieldName: resolvePrimaryFieldName(schema.fieldName),
      }),
      commonConfig,
      globalCommonConfig,
      ...schemaProps,
    });
  }

  return {
    ...arrayProps,
    ...componentProps,
    commonConfig,
    globalCommonConfig,
    ...schemaProps,
  };
}

function createArrayFieldSchema(
  schema: AnyFormSchema,
  options: CreateFormFieldSchemaOptions,
) {
  const restSchema = { ...(schema as AnyFormSchema & Record<string, any>) };
  Reflect.deleteProperty(restSchema, 'arrayProps');
  Reflect.deleteProperty(restSchema, 'children');
  Reflect.deleteProperty(restSchema, 'type');

  return {
    ...restSchema,
    component: 'VbenFormFieldArray',
    componentProps: createArrayComponentProps(schema, options),
  };
}

interface FormArraySchemaLike {
  children?: unknown;
  componentProps?: unknown;
}

interface UpdatableFormSchemaLike extends FormArraySchemaLike {
  fieldName: FormSchemaFieldName;
}

function setSchemaChildren<TSchema extends UpdatableFormSchemaLike>(
  schema: TSchema,
  children: TSchema[],
) {
  if ('children' in schema && Array.isArray(schema.children)) {
    return {
      ...schema,
      children,
    } as TSchema;
  }

  if (
    !isFunction(schema.componentProps) &&
    schema.componentProps &&
    Array.isArray((schema.componentProps as Record<string, any>).schema)
  ) {
    return {
      ...schema,
      componentProps: {
        ...(schema.componentProps as Record<string, any>),
        schema: children,
      },
    } as TSchema;
  }
  return schema;
}

export function getFormArraySchemaChildren<TSchema = FormSchema>(
  schema: FormArraySchemaLike,
): TSchema[] {
  if ('children' in schema && Array.isArray(schema.children)) {
    return schema.children as TSchema[];
  }

  const componentProps = schema.componentProps;
  if (
    !isFunction(componentProps) &&
    componentProps &&
    Array.isArray((componentProps as Record<string, any>).schema)
  ) {
    return (componentProps as Record<string, any>).schema as TSchema[];
  }

  return [];
}

export function isFormArraySchema(schema: Partial<AnyFormSchema>) {
  return (
    ('type' in schema && schema.type === 'array') ||
    schema.component === 'VbenFormFieldArray' ||
    getFormArraySchemaChildren(schema).length > 0
  );
}

export function resolveArrayChildFieldName(rowPath: string, fieldName: string) {
  return scopeRowFieldName(rowPath, fieldName);
}

export function updateFormSchemaList<TSchema extends UpdatableFormSchemaLike>(
  currentSchema: TSchema[],
  updated: Partial<TSchema>[],
): TSchema[] {
  return currentSchema.map((schema) => {
    const primaryFieldName = resolvePrimaryFieldName(schema.fieldName);
    const exactUpdatedData = updated.find(
      (item) =>
        item.fieldName !== undefined &&
        resolvePrimaryFieldName(item.fieldName) === primaryFieldName,
    );
    if (exactUpdatedData) {
      // 主字段名只是匹配键；更新项未显式给出字段名数组时，保留 schema 原有的多字段绑定
      const patch = { ...exactUpdatedData };
      if (!Array.isArray(patch.fieldName)) {
        Reflect.deleteProperty(patch, 'fieldName');
      }
      return mergeWithArrayOverride(patch, schema) as TSchema;
    }

    const children = getFormArraySchemaChildren<TSchema>(schema);
    if (children.length === 0) {
      return schema;
    }
    const childUpdates = updated.flatMap((item) => {
      const fieldName = item.fieldName
        ? resolveChildUpdateFieldName(
            primaryFieldName,
            resolvePrimaryFieldName(item.fieldName),
          )
        : undefined;
      return fieldName ? [{ ...item, fieldName } as Partial<TSchema>] : [];
    });
    if (childUpdates.length === 0) {
      return schema;
    }
    return setSchemaChildren(
      schema,
      updateFormSchemaList(children, childUpdates),
    );
  });
}

export function createFormFieldSchema(
  schema: AnyFormSchema,
  options: CreateFormFieldSchemaOptions = {},
): NormalizedFormFieldSchema {
  const commonConfig = mergeWithArrayOverride(
    options.commonConfig ?? {},
    options.globalCommonConfig ?? {},
  );
  const {
    changeEventFallback = false,
    colon = false,
    componentProps = {},
    controlClass = '',
    disabled,
    emptyStateValue = undefined,
    formFieldProps = {},
    formItemClass = '',
    hideLabel = false,
    hideRequiredMark = false,
    labelClass = '',
    labelWidth = 100,
    modelPropName = '',
    wrapperClass = '',
  } = commonConfig;

  const normalizedSchema = isFormArraySchema(schema)
    ? createArrayFieldSchema(schema, options)
    : schema;
  const fieldNames = resolveFieldNameList(normalizedSchema.fieldName);
  const primaryFieldName = fieldNames[0] ?? '';
  const commonComponentProps = isFunction(componentProps)
    ? componentProps({ fieldName: primaryFieldName })
    : componentProps;

  let resolvedSchemaFormItemClass = normalizedSchema.formItemClass;
  if (isFunction(normalizedSchema.formItemClass)) {
    try {
      resolvedSchemaFormItemClass = normalizedSchema.formItemClass();
    } catch (error) {
      console.error('Error calling formItemClass function:', error);
      resolvedSchemaFormItemClass = '';
    }
  }

  return {
    changeEventFallback,
    colon,
    emptyStateValue,
    hideRequiredMark,
    labelWidth,
    modelPropName,
    wrapperClass,
    ...normalizedSchema,
    commonComponentProps,
    componentProps: normalizedSchema.componentProps,
    fieldName: primaryFieldName,
    fieldNames,
    controlClass: [controlClass, normalizedSchema.controlClass]
      .filter(Boolean)
      .join(' '),
    formFieldProps: {
      ...formFieldProps,
      ...normalizedSchema.formFieldProps,
    },
    formItemClass: [
      'shrink-0',
      options.hidden ? 'hidden' : '',
      formItemClass,
      resolvedSchemaFormItemClass,
    ]
      .filter(Boolean)
      .join(' '),
    labelClass: [labelClass, normalizedSchema.labelClass]
      .filter(Boolean)
      .join(' '),
    disabled: options.disabled ?? normalizedSchema.disabled ?? disabled,
    hideLabel:
      options.forceHideLabel ?? normalizedSchema.hideLabel ?? hideLabel,
  } as NormalizedFormFieldSchema;
}

export function createArrayChildSchema(
  schema: AnyFormSchema,
  options: CreateArrayChildSchemaOptions,
): NormalizedFormFieldSchema {
  const rowPath = `${options.arrayField}[${options.index}]`;
  // 数组里的每个字段名都要限定到当前行；createFormFieldSchema 会再归一化出主字段
  const scopedFieldNames = resolveFieldNameList(schema.fieldName).map((name) =>
    resolveArrayChildFieldName(rowPath, name),
  );
  const baseContext: FormSchemaContext = {
    arrayField: options.arrayField,
    fieldName: scopedFieldNames[0] ?? '',
    originalFieldName: resolvePrimaryFieldName(schema.fieldName),
    rowIndex: options.index,
    rowPath,
  };

  return createFormFieldSchema(
    {
      ...schema,
      componentProps: wrapComponentProps(schema.componentProps, baseContext),
      dependencies: scopeDependencies(schema.dependencies, baseContext),
      fieldName: scopedFieldNames,
      help: wrapCustomParamsRender(schema.help, baseContext),
      renderComponentContent: wrapRenderComponentContent(
        schema.renderComponentContent,
        baseContext,
      ),
    },
    {
      commonConfig: wrapCommonConfig(options.commonConfig, baseContext),
      disabled: options.disabled || schema.disabled,
      forceHideLabel: true,
      globalCommonConfig: wrapCommonConfig(
        options.globalCommonConfig,
        baseContext,
      ),
    },
  );
}
