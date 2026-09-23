<template>
  <section class="curve-panel">
    <div class="panel-title">
      <div>
        <strong>结果数据</strong>
        <span>{{ curves.length }} 条数据线</span>
      </div>
      <el-button type="primary" size="small" :icon="Plus" @click="$emit('add')">新增</el-button>
    </div>

    <div class="curve-tabs">
      <button
        v-for="curve in curves"
        :key="curve.id"
        :class="{ active: curve.id === activeId }"
        @click="$emit('select', curve.id)"
      >
        <i :style="{ background: curve.color }"></i>
        <span>{{ curve.name }}</span>
        <b>{{ curve.points.length }}</b>
      </button>
    </div>

    <template v-if="activeCurve">
      <el-form label-position="top" class="curve-form">
        <div class="form-grid form-grid--name">
          <el-form-item label="数据线名称">
            <el-input v-model="activeName" clearable maxlength="30" placeholder="请输入数据线名称">
              <template #prefix><el-icon><EditPen /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="标注颜色">
            <el-color-picker :model-value="activeCurve.color" @update:model-value="update('color', $event)" />
          </el-form-item>
        </div>

        <div class="axis-section">
          <div class="axis-heading"><strong>X 轴范围</strong><el-button text type="primary" @click="$emit('tool', 'x-axis')">在图片标注</el-button></div>
          <div class="form-grid">
            <el-form-item label="最小值"><el-input-number :model-value="activeCurve.xMin" controls-position="right" @update:model-value="update('xMin', $event)" /></el-form-item>
            <el-form-item label="最大值"><el-input-number :model-value="activeCurve.xMax" controls-position="right" @update:model-value="update('xMax', $event)" /></el-form-item>
          </div>
          <p>{{ axisText(activeCurve.xAxis, '尚未标注 X 轴位置') }}</p>
        </div>

        <div class="axis-section">
          <div class="axis-heading"><strong>Y 轴范围</strong><el-button text type="primary" @click="$emit('tool', 'y-axis')">在图片标注</el-button></div>
          <div class="form-grid">
            <el-form-item label="最小值"><el-input-number :model-value="activeCurve.yMin" controls-position="right" @update:model-value="update('yMin', $event)" /></el-form-item>
            <el-form-item label="最大值"><el-input-number :model-value="activeCurve.yMax" controls-position="right" @update:model-value="update('yMax', $event)" /></el-form-item>
          </div>
          <p>{{ axisText(activeCurve.yAxis, '尚未标注 Y 轴位置') }}</p>
        </div>

        <el-form-item label="曲线选取方式">
          <el-radio-group :model-value="activeCurve.mode" @update:model-value="update('mode', $event)">
            <el-radio-button value="box">框选识别</el-radio-button>
            <el-radio-button value="trace">吸附描线</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div class="curve-summary">
        <span>已获取 <strong>{{ activeCurve.points.length }}</strong> 个点</span>
        <el-button text type="danger" :disabled="curves.length === 1" @click="$emit('remove', activeCurve.id)">删除数据线</el-button>
      </div>
    </template>
  </section>
</template>

<script setup>
/** 多数据线配置、坐标轴范围与选取方式面板。 */
import { computed } from 'vue';
import { Plus } from '@element-plus/icons-vue';

const props = defineProps({
  curves: { type: Array, required: true },
  activeId: { type: Number, required: true }
});

const emit = defineEmits(['add', 'remove', 'select', 'update', 'tool']);
const activeCurve = computed(() => props.curves.find((curve) => curve.id === props.activeId));
const activeName = computed({
  /** 读取当前数据线名称。 */
  get() {
    return activeCurve.value?.name || '';
  },
  /** 将输入的新名称同步给父级数据状态。 */
  set(value) {
    update('name', value);
  }
});

/** 更新当前数据线的单个配置字段。 */
function update(key, value) {
  emit('update', { id: props.activeId, key, value });
}

/** 将画布坐标转换为简短的轴标注状态。 */
function axisText(axis, emptyText) {
  if (!axis) return emptyText;
  return `起点 (${Math.round(axis.start.x)}, ${Math.round(axis.start.y)}) · 终点 (${Math.round(axis.end.x)}, ${Math.round(axis.end.y)})`;
}
</script>
