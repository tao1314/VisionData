<template>
  <el-dialog :model-value="modelValue" title="识别数据预览" width="760px" @update:model-value="$emit('update:modelValue', $event)">
    <el-table :data="rows" height="480" border stripe>
      <el-table-column type="index" label="#" width="60" />
      <el-table-column prop="curve" label="数据线" min-width="150" />
      <el-table-column prop="x" label="X" min-width="150" />
      <el-table-column prop="y" label="Y" min-width="150" />
    </el-table>
    <template #footer>
      <span>共 {{ rows.length }} 条数据</span>
      <el-button type="primary" @click="$emit('export')">导出 XLSX</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/** 结构化识别结果预览弹窗。 */
defineProps({
  modelValue: { type: Boolean, required: true },
  rows: { type: Array, default: () => [] }
});

defineEmits(['update:modelValue', 'export']);
</script>
