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
        <el-dropdown :disabled="!dataRows.length" @command="exportXlsx">
          <el-button type="primary" :disabled="!dataRows.length"><Download />导出数据<el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="active" :disabled="!activeCurve?.points.length">仅导出当前数据线</el-dropdown-item>
              <el-dropdown-item command="all">导出全部数据线</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
          <el-tooltip content="点击曲线拾取识别颜色" placement="bottom">
            <el-button :type="activeTool === 'color-picker' ? 'primary' : ''" :icon="Aim" @click="activateTool('color-picker')">吸管取色</el-button>
          </el-tooltip>
          <!-- 框选识别暂时停用，保留底层实现便于后续恢复。 -->
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

    <DataPreviewDialog
      v-model="previewVisible"
      :groups="dataGroups"
      :active-id="activeCurveId"
      @export="exportXlsx"
    />
  </section>
</template>

<script setup>
/** 图片取数工作台，负责数据线状态编排、坐标换算与结果导出。 */
import { computed, ref } from 'vue';
import { Aim, ArrowDown, Delete, Download, EditPen, RefreshLeft, Upload, View } from '@element-plus/icons-vue';
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
const activeTool = ref('trace');
const previewVisible = ref(false);
const history = ref([]);
const curves = ref([createCurve(1, 1)]);
const images = computed(() => store.state.recognition.images);
const activeImage = computed(() => images.value[activeImageIndex.value] || null);
const activeCurve = computed(() => curves.value.find((curve) => curve.id === activeCurveId.value));
const dataRows = computed(() => curves.value.flatMap((curve) => curve.points.map((point) => mapPoint(curve, point))));
/** 按数据线生成相互独立的预览数据组。 */
const dataGroups = computed(() => curves.value
  .filter((curve) => curve.points.length)
  .map((curve) => ({
    id: curve.id,
    name: curve.name,
    rows: curve.points.map((point) => mapPoint(curve, point))
  })));

/** 创建一条包含默认轴范围的空数据线。 */
function createCurve(id, sequence) {
  const colors = ['#3976e6', '#ef6c35', '#12a875', '#9b59d0', '#d9a21b'];
  return {
    id,
    name: `数据线 ${sequence}`,
    color: colors[(sequence - 1) % colors.length],
    targetColor: null,
    targetColors: [],
    recognitionTolerance: 18,
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    xAxis: null,
    yAxis: null,
    mode: 'trace',
    selectionBox: null,
    segments: [],
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
  activeTool.value = 'trace';
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
  activeTool.value = curve?.mode || 'trace';
}

/** 修改指定数据线字段并记录撤销快照。 */
function updateCurve({ id, key, value }) {
  const curve = curves.value.find((item) => item.id === id);
  if (!curve || curve[key] === value) return;
  saveHistory();
  curve[key] = value;
  if (key === 'targetColor') curve.targetColors = value ? [value] : [];
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
  activeCurve.value.segments = [];
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

/** 生成合法且不重复的 Excel 工作表名称。 */
function createWorksheetName(curve, index, usedNames) {
  const fallback = `数据线 ${index + 1}`;
  const base = String(curve.name || fallback).replace(/[:\\/?*[\]]/g, '_').slice(0, 31) || fallback;
  let name = base;
  let sequence = 2;
  while (usedNames.has(name)) {
    const suffix = `-${sequence}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    sequence += 1;
  }
  usedNames.add(name);
  return name;
}

/** 将当前时间格式化为文件名使用的年月日时分秒。 */
function formatExportDateTime(date = new Date()) {
  /** 为单个日期数字补齐两位。 */
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}：${pad(date.getMinutes())}：${pad(date.getSeconds())}`;
}

/** 替换 Windows 文件名不允许使用的字符。 */
function sanitizeFileName(name) {
  return String(name || '数据线').replace(/[<>:"/\\|?*]/g, '_').trim() || '数据线';
}

/** 按当前数据线或全部数据线分别导出 XLSX 工作表。 */
function exportXlsx(options = 'active') {
  const scope = typeof options === 'string' ? options : options.scope;
  const requestedCurveId = typeof options === 'object' ? options.curveId : activeCurveId.value;
  const selectedCurves = scope === 'all'
    ? curves.value.filter((curve) => curve.points.length)
    : curves.value.filter((curve) => curve.id === requestedCurveId && curve.points.length);
  if (!selectedCurves.length) {
    ElMessage.warning('暂无可导出的数据');
    return;
  }
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  selectedCurves.forEach((curve, index) => {
    const rows = curve.points.map((point) => {
      const mapped = mapPoint(curve, point);
      return { x: mapped.x, y: mapped.y };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ['x', 'y'] });
    XLSX.utils.sheet_add_aoa(worksheet, [['X', 'Y']], { origin: 'A1' });
    worksheet['!cols'] = [{ wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, createWorksheetName(curve, index, usedNames));
  });
  const prefix = scope === 'all' ? '全部数据' : sanitizeFileName(selectedCurves[0].name);
  XLSX.writeFile(workbook, `${prefix}${formatExportDateTime()}.xlsx`);
}
</script>
