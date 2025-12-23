import { createApp } from 'vue';
import { createHead } from '@vueuse/head';
import App from './App.vue';
import router from './router';
import pinia from '../lib/pinia';
import compsUi from '../lib/compsUi';
import vueI18n from '../lib/vueI18n';
import vRemixicon, { icons } from '../lib/vRemixicon';
import vueToastification from '../lib/vue-toastification';
import '../assets/css/tailwind.css';
import '../assets/css/fonts.css';
import '../assets/css/style.css';
import '../assets/css/flow.css';

const head = createHead();

const app = createApp(App);

try {
  console.log('Mounting: use head');
  app.use(head);
  console.log('Mounting: use router');
  app.use(router);
  console.log('Mounting: use compsUi');
  app.use(compsUi);
  console.log('Mounting: use pinia');
  app.use(pinia);
  console.log('Mounting: use vueI18n');
  app.use(vueI18n);
  console.log('Mounting: use vueToastification');
  app.use(vueToastification);
  console.log('Mounting: use vRemixicon');
  app.use(vRemixicon, icons);
  console.log('Mounting: mount #app');
  app.mount('#app');
} catch (error) {
  console.error('Error during mounting:', error);
}

if (module.hot) module.hot.accept();
