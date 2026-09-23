<template>
  <section class="page recognition-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">IMAGE TO DATA</p>
        <h1>图片识别转数据</h1>
        <p>导入图片，执行识别并校对结构化结果。</p>
      </div>
      <div class="heading-actions">
        <el-button @click="resetWorkspace">清空</el-button>
        <el-button type="primary" :loading="recognizing" :disabled="!images.length" @click="runRecognition">
          开始识别
        </el-button>
      </div>
    </div>

    <el-row :gutter="18">
      <el-col :span="9">
        <el-card class="workspace-card" shadow="never">
          <template #header>
            <div class="card-header"><strong>图片队列</strong><el-tag>{{ images.length }} 张</el-tag></div>
          </template>
          <button class="drop-zone" @click="selectImages">
            <el-icon :size="34"><UploadFilled /></el-icon>
            <strong>选择图片</strong>
            <span>支持 PNG、JPG、BMP、WebP、TIFF，可多选</span>
          </button>
          <div v-if="images.length" class="image-list">
            <div v-for="image in images" :key="image.path" class="image-item">
              <el-icon><Picture /></el-icon>
              <div><strong>{{ image.name }}</strong><span>{{ image.path }}</span></div>
              <el-tag size="small" type="info">待识别</el-tag>
            </div>
          </div>
          <el-empty v-else description="尚未导入图片" :image-size="84" />
        </el-card>
      </el-col>

      <el-col :span="15">
        <el-card class="workspace-card" shadow="never">
          <template #header>
            <div class="card-header">
              <strong>结构化结果</strong>
              <span class="muted">{{ taskStatus }}</span>
            </div>
          </template>
          <el-table v-if="resultRows.length" :data="resultRows" height="520" border>
            <el-table-column type="index" width="58" label="#" />
            <el-table-column v-for="column in resultColumns" :key="column" :prop="column" :label="column" min-width="140" />
          </el-table>
          <el-empty v-else description="识别结果将在这里展示" :image-size="118">
            <el-button type="primary" plain @click="selectImages">导入第一张图片</el-button>
          </el-empty>
        </el-card>
      </el-col>
    </el-row>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useStore } from 'vuex';
import { recognitionApi } from '@/api/electron';

const store = useStore();
const recognizing = ref(false);
const images = computed(() => store.state.recognition.images);
const resultRows = computed(() => store.state.recognition.resultRows);
const resultColumns = computed(() => Object.keys(resultRows.value[0] || {}));
const taskStatus = computed(() => store.state.recognition.currentTask?.message || '等待识别任务');

/** 从系统文件选择器导入图片。 */
async function selectImages() {
  try {
    const selected = await recognitionApi.selectImages();
    if (selected.length) store.commit('recognition/setImages', selected);
  } catch (error) {
    ElMessage.warning(error.message);
  }
}

/** 将当前图片队列提交给主进程识别服务。 */
async function runRecognition() {
  recognizing.value = true;
  try {
    const task = await recognitionApi.run({ images: images.value });
    store.commit('recognition/setTask', task);
    ElMessage.info(task.message);
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    recognizing.value = false;
  }
}

/** 清空当前导入图片和识别结果。 */
function resetWorkspace() {
  store.commit('recognition/reset');
}
</script>
