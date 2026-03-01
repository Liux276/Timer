import { setApiAuthHandlers } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import naive from 'naive-ui';
import App from './App.vue';
import './assets/main.css';
import router from './router';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const authStore = useAuthStore(pinia);
setApiAuthHandlers({
  onUnauthorized: () => {
    authStore.logout();
  },
  onNetworkError: () => {
    authStore.markServerUnreachable();
  },
});

app.use(router);
void authStore.ensureSession();
app.use(naive);
app.mount('#app');
