import { createStore } from 'vuex';
import app from './modules/app';
import recognition from './modules/recognition';

export default createStore({
  strict: import.meta.env.DEV,
  modules: { app, recognition }
});
