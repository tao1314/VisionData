<template>
  <header class="title-bar">
    <div class="title-bar__brand">
      <span class="brand-mark"><DataAnalysis /></span>
      <span>VisionData 图数智取</span>
    </div>
    <div class="title-bar__actions">
      <button aria-label="最小化" @click="windowApi.minimize()"><Minus /></button>
      <button aria-label="最大化" @click="windowApi.toggleMaximize()"><FullScreen /></button>
      <button class="danger" aria-label="关闭" @click="windowApi.close()"><Close /></button>
    </div>
  </header>
</template>

<script setup>
import { Close, DataAnalysis, FullScreen, Minus } from '@element-plus/icons-vue';
import { windowApi } from '@/api/electron';
</script>
