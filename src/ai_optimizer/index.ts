import { createApp } from 'vue';
import Panel from './Panel.vue';
import { createPinia } from 'pinia';

const pinia = createPinia();
const app = createApp(Panel);
app.use(pinia);
app.mount('#app');
