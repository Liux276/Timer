<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-radial" style="background-color: var(--color-bg-base)">
    <div class="card-glass w-full max-w-md p-8 sm:p-10 animate-float-up card-no-hover">
      <div class="text-center mb-6">
        <div
          class="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
          style="background: color-mix(in srgb, var(--color-error) 16%, white)"
        >
          <AppIcon name="settings" :size="26" color="var(--color-error)" />
        </div>
        <h1 class="text-h2" style="color: var(--color-text-primary)">初始化状态不可用</h1>
        <p class="text-caption mt-2">
          无法从服务器获取系统初始化状态，请检查后端服务和反向代理后重试。
        </p>
      </div>

      <div class="space-y-3">
        <n-button
          type="primary"
          block
          :loading="retrying"
          @click="retry"
          style="height: 44px; font-size: 15px; font-weight: 600"
        >
          重试检测
        </n-button>
        <n-button block secondary @click="goHealth">
          打开健康检查
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clearSetupCache } from '@/router';
import AppIcon from '@/components/common/AppIcon.vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const retrying = ref(false);

const redirectTarget = computed(() => {
  const redirect = route.query.redirect;
  if (typeof redirect !== 'string' || !redirect.startsWith('/')) {
    return '/';
  }
  return redirect;
});

async function retry() {
  retrying.value = true;
  clearSetupCache();
  try {
    await router.replace(redirectTarget.value);
  } finally {
    retrying.value = false;
  }
}

function goHealth() {
  window.open('/api/health', '_blank');
}
</script>
