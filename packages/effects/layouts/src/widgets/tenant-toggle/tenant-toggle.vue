<script setup lang="ts">
import type { TenantItem } from './types';

import { Check, ChevronsUpDown } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  VbenLogo,
} from '@vben-core/shadcn-ui';

/**
 * 以 Logo 区作为触发器的租户切换器，未声明的属性透传给 VbenLogo
 */
defineOptions({
  name: 'TenantToggle',
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    /** 是否收起，收起时只展示 Logo 图标 */
    collapsed?: boolean;
    /** 可切换的租户列表，为空时只展示 Logo */
    tenants?: TenantItem[];
    /** Logo 文本 */
    text?: string;
    /** Logo 所在区域的主题 */
    theme?: string;
  }>(),
  {
    collapsed: false,
    tenants: () => [],
    text: '',
    theme: 'light',
  },
);

/** 当前租户编码 */
const modelValue = defineModel<string>();
</script>

<template>
  <DropdownMenu v-if="tenants.length > 0">
    <div :class="theme" class="flex h-full items-center px-2 py-1.5">
      <DropdownMenuTrigger as-child>
        <div
          :class="{ 'pr-2': !collapsed }"
          class="flex h-full min-w-0 flex-1 cursor-pointer items-center rounded-md transition-colors hover:bg-accent data-[state=open]:bg-accent"
        >
          <VbenLogo
            v-bind="$attrs"
            :collapsed="collapsed"
            :text="text"
            :theme="theme"
            class="min-w-0 flex-1"
          />
          <ChevronsUpDown
            v-if="!collapsed"
            class="size-4 shrink-0 text-muted-foreground"
          />
        </div>
      </DropdownMenuTrigger>
    </div>
    <DropdownMenuContent
      align="start"
      class="w-(--reka-dropdown-menu-trigger-width) min-w-48 rounded-lg"
    >
      <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
        {{ $t('ui.widgets.tenant.switchTenant') }}
      </DropdownMenuLabel>
      <DropdownMenuItem
        v-for="tenant in tenants"
        :key="tenant.code"
        class="cursor-pointer p-2"
        @click="modelValue = tenant.code"
      >
        <Avatar class="size-6 rounded-md border">
          <AvatarImage
            :alt="tenant.name"
            :src="tenant.logo ?? ''"
            class="object-contain"
          />
          <AvatarFallback class="rounded-md text-xs">
            {{ tenant.name.charAt(0) }}
          </AvatarFallback>
        </Avatar>
        <span class="flex-1 truncate">{{ tenant.name }}</span>
        <Check v-if="tenant.code === modelValue" class="size-4 text-primary" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <VbenLogo
    v-else
    v-bind="$attrs"
    :collapsed="collapsed"
    :text="text"
    :theme="theme"
  />
</template>
