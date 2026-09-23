import { createRouter, createWebHashHistory } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';

const routes = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/recognition',
    children: [
      {
        path: 'recognition',
        name: 'Recognition',
        component: () => import('@/views/recognition/index.vue'),
        meta: { title: '图片识别', icon: 'Picture' }
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/tasks/index.vue'),
        meta: { title: '任务记录', icon: 'Tickets' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.afterEach((to) => {
  document.title = `${to.meta.title || '页面'} - VisionData`;
});

export default router;
