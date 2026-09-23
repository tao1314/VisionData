<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">APPLICATION</p>
        <h1>关于 VisionData</h1>
        <p>运行时信息通过安全 preload 桥接从 Electron 主进程获取。</p>
      </div>
    </div>
    <el-card shadow="never">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="应用名称">{{ info?.name || '读取中...' }}</el-descriptions-item>
        <el-descriptions-item label="应用版本">{{ info?.version || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作系统">{{ info?.platform || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Electron">{{ info?.electron || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Node.js">{{ info?.node || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { appApi } from '@/api/electron';

const info = ref(null);

/** 加载当前桌面应用版本与运行时信息。 */
onMounted(async () => {
  try {
    info.value = await appApi.getInfo();
  } catch {
    info.value = { name: '浏览器预览模式' };
  }
});
</script>
