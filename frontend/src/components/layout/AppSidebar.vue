<template>
  <aside class="sidebar collapsed">
    <el-menu router :default-active="route.path" :collapse="true">
      <el-menu-item index="/recognition">
        <el-icon><Picture /></el-icon>
        <template #title>图片识别</template>
      </el-menu-item>
      <el-menu-item index="/tasks">
        <el-icon><Tickets /></el-icon>
        <template #title>任务记录</template>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<script setup>
/** 固定图标模式的应用主导航。 */
import { useRoute } from 'vue-router';

const route = useRoute();
</script>
