import Framework7Vue, { registerComponents } from 'framework7-vue/bundle';
import Framework7 from 'framework7/lite-bundle';
import { createApp } from 'vue';
import App from './App.vue';

// Import Framework7 Styles
import 'framework7/css/bundle';

// Import Custom Design System
import './index.css';

// Init F7 Vue Plugin
Framework7.use(Framework7Vue);

const app = createApp(App);

// Register F7 Vue Components
registerComponents(app);

app.mount('#app');
