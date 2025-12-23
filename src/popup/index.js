import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import pinia from '../lib/pinia';
import compsUi from '../lib/compsUi';
import vueI18n from '../lib/vueI18n';
import vRemixicon, { icons } from '../lib/vRemixicon';
import '../assets/css/tailwind.css';
import '../assets/css/fonts.css';
import '../assets/css/flow.css';

const app = createApp(App);

try {
  console.log('Mounting popup: use router');
  app.use(router);
  console.log('Mounting popup: use compsUi');
  app.use(compsUi);
  console.log('Mounting popup: use vueI18n');
  app.use(vueI18n);
  console.log('Mounting popup: use pinia');
  app.use(pinia);
  console.log('Mounting popup: use vRemixicon');
  app.use(vRemixicon, icons);
  console.log('Mounting popup: mount #app');
  app.mount('#app');
} catch (error) {
  console.error('Error during mounting popup:', error);
}

if (module.hot) module.hot.accept();
