<template>
  <aside class="sidebar" :class="{ collapsed }">
    <el-menu router :default-active="route.path" :collapse="collapsed">
      <el-menu-item index="/recognition">
        <el-icon><Picture /></el-icon>
        <template #title>图片识别</template>
      </el-menu-item>
      <el-menu-item index="/tasks">
        <el-icon><Tickets /></el-icon>
        <template #title>任务记录</template>
      </el-menu-item>
      <el-menu-item index="/about">
        <el-icon><InfoFilled /></el-icon>
        <template #title>关于项目</template>
      </el-menu-item>
    </el-menu>
    <button class="collapse-button" @click="store.commit('app/toggleSidebar')">
      <el-icon><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
    </button>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';

const route = useRoute();
const store = useStore();
const collapsed = computed(() => store.state.app.sidebarCollapsed);
</script>
