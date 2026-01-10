import { createRouter, createWebHistory } from 'vue-router'
import Scheduler from '@/views/Scheduler.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'scheduler',
      component: Scheduler,
    },
  ],
})

export default router
