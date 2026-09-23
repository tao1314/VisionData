<template>
  <section class="recognition-workbench">
    <aside class="result-pane">
      <CurvePanel
        class="result-pane__content"
        :curves="curves"
        :active-id="activeCurveId"
        @add="addCurve"
        @remove="removeCurve"
        @select="selectCurve"
        @update="updateCurve"
        @tool="activateTool"
      />
      <footer class="result-actions">
        <div><strong>{{ dataRows.length }}</strong><span>数据点</span></div>
        <el-button :disabled="!dataRows.length" @click="previewVisible = true"><View />查看数据</el-button>
        <el-button type="primary" :disabled="!dataRows.length" @click="exportXlsx"><Download />导出数据</el-button>
      </footer>
    </aside>

    <main class="image-pane">
      <header class="image-toolbar">
        <div class="tool-group">
          <el-select v-if="images.length" v-model="activeImageIndex" class="image-selector">
            <el-option v-for="(image, index) in images" :key="image.path" :label="image.name" :value="index" />
          </el-select>
        </div>
        <div class="tool-group tool-group--modes">
          <el-tooltip content="拖动矩形区域自动提取曲线" placement="bottom">
            <el-button :type="activeTool === 'box' ? 'primary' : ''" :icon="Crop" @click="activateTool('box')">框选</el-button>
          </el-tooltip>
          <el-tooltip content="沿曲线拖动，指针将吸附到附近边缘" placement="bottom">
            <el-button :type="activeTool === 'trace' ? 'primary' : ''" :icon="EditPen" @click="activateTool('trace')">吸附描线</el-button>
          </el-tooltip>
          <el-tooltip content="标定 X 轴最小值到最大值的位置" placement="bottom">
            <el-button :type="activeTool === 'x-axis' ? 'primary' : ''" @click="activateTool('x-axis')">标注 X 轴</el-button>
          </el-tooltip>
          <el-tooltip content="标定 Y 轴最小值到最大值的位置" placement="bottom">
            <el-button :type="activeTool === 'y-axis' ? 'primary' : ''" @click="activateTool('y-axis')">标注 Y 轴</el-button>
          </el-tooltip>
        </div>
        <div class="tool-group tool-group--right">
          <el-button :icon="RefreshLeft" :disabled="!history.length" @click="undo">撤销</el-button>
          <el-button :icon="Delete" @click="clearActiveCurve">清除选取</el-button>
          <el-button type="primary" :icon="Upload" @click="selectImages">导入图片</el-button>
        </div>
      </header>

      <ImageWorkspace
        :image="activeImage"
        :curves="curves"
        :active-id="activeCurveId"
        :tool="activeTool"
        @curve-change="updateCurve"
        @tool-complete="activateTool"
      />
    </main>

    <DataPreviewDialog v-model="previewVisible" :rows="dataRows" @export="exportXlsx" />
  </section>
</template>

<script setup>
/** 图片取数工作台，负责数据线状态编排、坐标换算与结果导出。 */
import { computed, ref } from 'vue';
import { Crop, Delete, Download, EditPen, RefreshLeft, Upload, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import * as XLSX from 'xlsx';
import { useStore } from 'vuex';
import CurvePanel from '@/components/recognition/CurvePanel.vue';
import DataPreviewDialog from '@/components/recognition/DataPreviewDialog.vue';
import ImageWorkspace from '@/components/recognition/ImageWorkspace.vue';
import { recognitionApi } from '@/api/electron';

const store = useStore();
const activeImageIndex = ref(0);
const activeCurveId = ref(1);
const activeTool = ref('box');
const previewVisible = ref(false);
const history = ref([]);
const curves = ref([createCurve(1, 1)]);
const images = computed(() => store.state.recognition.images);
const activeImage = computed(() => images.value[activeImageIndex.value] || null);
const activeCurve = computed(() => curves.value.find((curve) => curve.id === activeCurveId.value));
const dataRows = computed(() => curves.value.flatMap((curve) => curve.points.map((point) => mapPoint(curve, point))));

/** 创建一条包含默认轴范围的空数据线。 */
function createCurve(id, sequence) {
  const colors = ['#3976e6', '#ef6c35', '#12a875', '#9b59d0', '#d9a21b'];
  return {
    id,
    name: `数据线 ${sequence}`,
    color: colors[(sequence - 1) % colors.length],
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    xAxis: null,
    yAxis: null,
    mode: 'box',
    selectionBox: null,
    points: []
  };
}

/** 保存可撤销的当前数据线快照。 */
function saveHistory() {
  history.value.push(JSON.stringify(curves.value));
  if (history.value.length > 50) history.value.shift();
}

/** 新增并激活一条独立数据线。 */
function addCurve() {
  saveHistory();
  const id = Date.now();
  curves.value.push(createCurve(id, curves.value.length + 1));
  activeCurveId.value = id;
  activeTool.value = 'box';
}

/** 删除指定数据线并切换到剩余数据线。 */
function removeCurve(id) {
  if (curves.value.length === 1) return;
  saveHistory();
  curves.value = curves.value.filter((curve) => curve.id !== id);
  activeCurveId.value = curves.value[0].id;
}

/** 切换当前编辑的数据线并同步其选取方式。 */
function selectCurve(id) {
  activeCurveId.value = id;
  const curve = curves.value.find((item) => item.id === id);
  activeTool.value = curve?.mode || 'box';
}

/** 修改指定数据线字段并记录撤销快照。 */
function updateCurve({ id, key, value }) {
  const curve = curves.value.find((item) => item.id === id);
  if (!curve || curve[key] === value) return;
  saveHistory();
  curve[key] = value;
  if (key === 'mode') activeTool.value = value;
}

/** 切换画布工具，并在框选和描线工具间同步数据线模式。 */
function activateTool(tool) {
  activeTool.value = tool;
  if ((tool === 'box' || tool === 'trace') && activeCurve.value && activeCurve.value.mode !== tool) {
    updateCurve({ id: activeCurveId.value, key: 'mode', value: tool });
  }
}

/** 从系统文件选择器导入一组图片。 */
async function selectImages() {
  try {
    const selected = await recognitionApi.selectImages();
    if (!selected.length) return;
    store.commit('recognition/setImages', selected);
    activeImageIndex.value = 0;
  } catch (error) {
    ElMessage.warning(error.message);
  }
}

/** 撤销最近一次数据线配置或画布操作。 */
function undo() {
  const snapshot = history.value.pop();
  if (!snapshot) return;
  curves.value = JSON.parse(snapshot);
  if (!curves.value.some((curve) => curve.id === activeCurveId.value)) activeCurveId.value = curves.value[0].id;
}

/** 清除当前数据线的选区和采样结果，保留轴标定配置。 */
function clearActiveCurve() {
  if (!activeCurve.value) return;
  saveHistory();
  activeCurve.value.points = [];
  activeCurve.value.selectionBox = null;
}

/** 将图像像素点按用户标定的坐标轴换算成业务数据。 */
function mapPoint(curve, point) {
  const x = mapAxisValue(point, curve.xAxis, curve.xMin, curve.xMax, 'x');
  const y = mapAxisValue(point, curve.yAxis, curve.yMin, curve.yMax, 'y');
  return { curve: curve.name, x: formatNumber(x), y: formatNumber(y) };
}

/** 按坐标轴方向投影像素点并换算为数值。 */
function mapAxisValue(point, axis, min, max, fallbackKey) {
  if (!axis) return point[fallbackKey];
  const vector = { x: axis.end.x - axis.start.x, y: axis.end.y - axis.start.y };
  const lengthSquared = vector.x ** 2 + vector.y ** 2;
  if (!lengthSquared) return min;
  const ratio = ((point.x - axis.start.x) * vector.x + (point.y - axis.start.y) * vector.y) / lengthSquared;
  return min + ratio * (max - min);
}

/** 输出便于查看和导出的有限精度数值。 */
function formatNumber(value) {
  return Number(Number(value).toFixed(6));
}

/** 将全部数据线结果导出为 XLSX 工作簿。 */
function exportXlsx() {
  if (!dataRows.value.length) {
    ElMessage.warning('暂无可导出的数据');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(dataRows.value, { header: ['curve', 'x', 'y'] });
  XLSX.utils.sheet_add_aoa(worksheet, [['数据线', 'X', 'Y']], { origin: 'A1' });
  worksheet['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '识别数据');
  XLSX.writeFile(workbook, `VisionData-${Date.now()}.xlsx`);
}
</script>
