<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-radial" style="background-color: var(--color-bg-base)">
    <div class="card-glass w-full max-w-md p-8 sm:p-10 animate-float-up card-no-hover">
      <!-- Logo & Title -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
          style="background: var(--color-accent-light)"
        >
          <AppIcon name="clipboard" :size="28" color="var(--color-accent)" />
        </div>
        <h1 class="text-h2" style="color: var(--color-text-primary)">任务管理</h1>
        <p class="text-caption mt-2">登录您的账户</p>
      </div>

      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" placeholder="请输入用户名" @keyup.enter="handleSubmit" />
        </n-form-item>

        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" @keyup.enter="handleSubmit" />
        </n-form-item>
      </n-form>

      <n-button
        type="primary"
        block
        :loading="loading"
        @click="handleSubmit"
        style="height: 44px; font-size: 15px; font-weight: 600"
      >
        登 录
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, type FormInst, type FormRules } from 'naive-ui';
import { useAuthStore } from '@/stores/authStore';
import AppIcon from '@/components/common/AppIcon.vue';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const loading = ref(false);
const formRef = ref<FormInst | null>(null);

const form = reactive({
  username: '',
  password: '',
});

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度 2-32 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 128, message: '密码长度 6-128 位', trigger: 'blur' },
  ],
};

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    await authStore.login(form.username, form.password);
    message.success('登录成功');
    router.push('/');
  } catch (e: any) {
    if (!e?.response) {
      message.error('无法连接后端服务，请检查服务状态后重试');
    } else if (e.response.status === 400 || e.response.status === 401) {
      message.error(e.response?.data?.error || '用户名或密码错误');
    } else {
      message.error(e.response?.data?.error || '登录失败');
    }
  } finally {
    loading.value = false;
  }
}
</script>
