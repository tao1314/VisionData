<template>
  <el-dialog :model-value="modelValue" title="识别数据预览" width="760px" @update:model-value="$emit('update:modelValue', $event)">
    <div class="preview-curve-switcher">
      <span>查看数据线</span>
      <el-select v-model="selectedCurveId" placeholder="请选择数据线">
        <el-option v-for="group in groups" :key="group.id" :label="`${group.name}（${group.rows.length} 个点）`" :value="group.id" />
      </el-select>
    </div>
    <el-table :data="selectedGroup?.rows || []" height="440" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="x" label="X" min-width="150" />
      <el-table-column prop="y" label="Y" min-width="150" />
    </el-table>
    <template #footer>
      <span>{{ selectedGroup?.name || '未选择数据线' }} · {{ selectedGroup?.rows.length || 0 }} 个点</span>
      <div>
        <el-button :disabled="!selectedGroup" @click="$emit('export', { scope: 'curve', curveId: selectedCurveId })">导出当前数据线</el-button>
        <el-button type="primary" :disabled="!groups.length" @click="$emit('export', { scope: 'all' })">导出全部数据线</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
/** 结构化识别结果预览弹窗。 */
import { computed, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  groups: { type: Array, default: () => [] },
  activeId: { type: Number, required: true }
});

defineEmits(['update:modelValue', 'export']);

const selectedCurveId = ref(props.activeId);
/** 获取预览下拉框当前选中的独立数据线。 */
const selectedGroup = computed(() => props.groups.find((group) => group.id === selectedCurveId.value));

/** 打开弹窗或数据线变化时选择当前数据线，并在其无数据时回退到第一条可用线。 */
function syncSelectedCurve() {
  const activeAvailable = props.groups.some((group) => group.id === props.activeId);
  if (activeAvailable) selectedCurveId.value = props.activeId;
  else if (!selectedGroup.value) selectedCurveId.value = props.groups[0]?.id;
}

watch(() => [props.modelValue, props.activeId, props.groups], syncSelectedCurve, { deep: true });
</script>
