<template>
  <section ref="stageRef" class="image-stage" :class="`tool-${tool}`">
    <canvas
      v-show="image"
      ref="canvasRef"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerUp"
    ></canvas>
    <el-empty v-if="!image" description="请先导入需要识别的图片" :image-size="120" />
    <div v-if="image" class="stage-status">
      <span>{{ image.name }}</span>
      <span>{{ imageSize }}</span>
      <span>{{ toolHint }}</span>
    </div>
  </section>
</template>

<script setup>
/** 图片绘制、坐标轴标定、框选识别与吸附描线画布。 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  image: { type: Object, default: null },
  curves: { type: Array, required: true },
  activeId: { type: Number, required: true },
  tool: { type: String, default: 'box' }
});

const emit = defineEmits(['curve-change', 'tool-complete']);
const stageRef = ref();
const canvasRef = ref();
const sourceImage = new Image();
const offscreen = document.createElement('canvas');
const view = { scale: 1, offsetX: 0, offsetY: 0 };
const drag = ref(null);
const imageDimensions = ref({ width: 0, height: 0 });
let resizeObserver;
let sourcePixels = null;

const activeCurve = computed(() => props.curves.find((curve) => curve.id === props.activeId));
const imageSize = computed(() => imageDimensions.value.width ? `${imageDimensions.value.width} × ${imageDimensions.value.height}px` : '读取中');
const toolHint = computed(() => ({
  box: '拖动框选曲线区域',
  trace: '按住并沿曲线描绘，自动吸附',
  'x-axis': '沿 X 轴从最小值拖至最大值',
  'y-axis': '沿 Y 轴从最小值拖至最大值'
}[props.tool] || '选择工具'));

/** 加载当前图片并缓存像素数据供吸附算法使用。 */
function loadImage() {
  sourcePixels = null;
  if (!props.image?.dataUrl) {
    sourceImage.src = '';
    imageDimensions.value = { width: 0, height: 0 };
    draw();
    return;
  }
  sourceImage.onload = () => {
    offscreen.width = sourceImage.naturalWidth;
    offscreen.height = sourceImage.naturalHeight;
    const context = offscreen.getContext('2d', { willReadFrequently: true });
    context.drawImage(sourceImage, 0, 0);
    sourcePixels = context.getImageData(0, 0, offscreen.width, offscreen.height);
    imageDimensions.value = { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight };
    draw();
  };
  sourceImage.src = props.image.dataUrl;
}

/** 调整画布物理像素并保持高清显示。 */
function resizeCanvas() {
  const canvas = canvasRef.value;
  const stage = stageRef.value;
  if (!canvas || !stage) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(stage.clientWidth, 1);
  const height = Math.max(stage.clientHeight, 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  draw();
}

/** 绘制底图、坐标轴、选区与所有数据线。 */
function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#eef2f7';
  context.fillRect(0, 0, width, height);
  if (!props.image || !sourceImage.naturalWidth) return;

  view.scale = Math.min((width - 48) / sourceImage.naturalWidth, (height - 70) / sourceImage.naturalHeight);
  view.offsetX = (width - sourceImage.naturalWidth * view.scale) / 2;
  view.offsetY = (height - sourceImage.naturalHeight * view.scale) / 2;
  context.drawImage(sourceImage, view.offsetX, view.offsetY, sourceImage.naturalWidth * view.scale, sourceImage.naturalHeight * view.scale);

  for (const curve of props.curves) drawCurve(context, curve);
  if (drag.value) drawDragPreview(context, drag.value);
}

/** 绘制单条数据线的标定信息和采样点。 */
function drawCurve(context, curve) {
  const active = curve.id === props.activeId;
  context.save();
  context.lineWidth = active ? 2.4 : 1.4;
  context.globalAlpha = active ? 1 : .45;
  drawAxis(context, curve.xAxis, '#15a6d8', 'X');
  drawAxis(context, curve.yAxis, '#16a36a', 'Y');
  if (curve.selectionBox) {
    const start = toCanvasPoint(curve.selectionBox.start);
    const end = toCanvasPoint(curve.selectionBox.end);
    context.strokeStyle = curve.color;
    context.setLineDash([6, 4]);
    context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    context.setLineDash([]);
  }
  if (curve.points.length) {
    context.beginPath();
    curve.points.forEach((point, index) => {
      const position = toCanvasPoint(point);
      index ? context.lineTo(position.x, position.y) : context.moveTo(position.x, position.y);
    });
    context.strokeStyle = curve.color;
    context.lineWidth = active ? 2.6 : 1.6;
    context.stroke();
  }
  context.restore();
}

/** 绘制一条坐标标定线及端点。 */
function drawAxis(context, axis, color, label) {
  if (!axis) return;
  const start = toCanvasPoint(axis.start);
  const end = toCanvasPoint(axis.end);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.strokeStyle = color;
  context.stroke();
  context.fillStyle = color;
  for (const point of [start, end]) {
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.font = '600 12px sans-serif';
  context.fillText(label, start.x + 7, start.y - 7);
}

/** 绘制用户当前正在拖动的操作预览。 */
function drawDragPreview(context, state) {
  if (!state.start || !state.current) return;
  if (state.tool === 'trace' && state.points.length) {
    context.save();
    context.beginPath();
    state.points.forEach((point, index) => {
      const position = toCanvasPoint(point);
      index ? context.lineTo(position.x, position.y) : context.moveTo(position.x, position.y);
    });
    context.strokeStyle = activeCurve.value?.color || '#3976e6';
    context.lineWidth = 2.6;
    context.stroke();
    context.restore();
    return;
  }
  const start = toCanvasPoint(state.start);
  const end = toCanvasPoint(state.current);
  context.save();
  context.strokeStyle = state.tool === 'x-axis' ? '#15a6d8' : state.tool === 'y-axis' ? '#16a36a' : activeCurve.value?.color || '#3976e6';
  context.lineWidth = 2;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  if (state.tool !== 'box') {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
  }
  context.stroke();
  context.restore();
}

/** 将画布指针事件换算为原图像素坐标。 */
function toImagePoint(event) {
  const bounds = canvasRef.value.getBoundingClientRect();
  return clampPoint({
    x: (event.clientX - bounds.left - view.offsetX) / view.scale,
    y: (event.clientY - bounds.top - view.offsetY) / view.scale
  });
}

/** 将原图像素坐标转换为当前画布显示坐标。 */
function toCanvasPoint(point) {
  return { x: view.offsetX + point.x * view.scale, y: view.offsetY + point.y * view.scale };
}

/** 限制采样点始终位于原图范围内。 */
function clampPoint(point) {
  return {
    x: Math.max(0, Math.min(sourceImage.naturalWidth - 1, point.x)),
    y: Math.max(0, Math.min(sourceImage.naturalHeight - 1, point.y))
  };
}

/** 在指针邻域内寻找灰度梯度最大的像素，实现曲线吸附。 */
function snapPoint(point, radius = 9) {
  if (!sourcePixels) return point;
  let best = clampPoint(point);
  let bestScore = -1;
  const centerX = Math.round(point.x);
  const centerY = Math.round(point.y);
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 1 || y < 1 || x >= sourcePixels.width - 1 || y >= sourcePixels.height - 1) continue;
      const score = pixelGradient(x, y) - Math.hypot(x - centerX, y - centerY) * 2;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

/** 计算单个像素的水平和垂直灰度梯度。 */
function pixelGradient(x, y) {
  const width = sourcePixels.width;
  const data = sourcePixels.data;
  /** 读取指定像素的感知亮度。 */
  const luminance = (px, py) => {
    const index = (py * width + px) * 4;
    return data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114;
  };
  return Math.abs(luminance(x + 1, y) - luminance(x - 1, y)) + Math.abs(luminance(x, y + 1) - luminance(x, y - 1));
}

/** 从框选区域按列提取梯度最强的候选曲线点。 */
function extractBoxPoints(start, end) {
  if (!sourcePixels) return [];
  const left = Math.round(Math.min(start.x, end.x));
  const right = Math.round(Math.max(start.x, end.x));
  const top = Math.round(Math.min(start.y, end.y));
  const bottom = Math.round(Math.max(start.y, end.y));
  const step = Math.max(1, Math.ceil((right - left) / 260));
  const points = [];
  for (let x = left; x <= right; x += step) {
    let bestY = top;
    let bestScore = -1;
    for (let y = Math.max(top, 1); y <= Math.min(bottom, sourcePixels.height - 2); y += 1) {
      const score = pixelGradient(x, y);
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }
    points.push({ x, y: bestY });
  }
  return points;
}

/** 开始坐标轴、框选或吸附描线操作。 */
function handlePointerDown(event) {
  if (!props.image || !activeCurve.value) return;
  canvasRef.value.setPointerCapture(event.pointerId);
  const point = toImagePoint(event);
  drag.value = { tool: props.tool, start: point, current: point, points: props.tool === 'trace' ? [snapPoint(point)] : [] };
  draw();
}

/** 更新当前操作位置，并持续采样吸附描线点。 */
function handlePointerMove(event) {
  if (!drag.value) return;
  const point = toImagePoint(event);
  drag.value.current = point;
  if (drag.value.tool === 'trace') {
    const snapped = snapPoint(point);
    const previous = drag.value.points.at(-1);
    if (!previous || Math.hypot(snapped.x - previous.x, snapped.y - previous.y) >= 2) drag.value.points.push(snapped);
  }
  draw();
}

/** 完成当前操作并将结果提交给父组件。 */
function handlePointerUp(event) {
  if (!drag.value || !activeCurve.value) return;
  const state = drag.value;
  drag.value = null;
  if (state.tool === 'x-axis' || state.tool === 'y-axis') {
    emit('curve-change', { id: props.activeId, key: state.tool === 'x-axis' ? 'xAxis' : 'yAxis', value: { start: state.start, end: state.current } });
    emit('tool-complete', activeCurve.value.mode);
  } else if (state.tool === 'box') {
    emit('curve-change', { id: props.activeId, key: 'selectionBox', value: { start: state.start, end: state.current } });
    emit('curve-change', { id: props.activeId, key: 'points', value: extractBoxPoints(state.start, state.current) });
  } else if (state.tool === 'trace') {
    emit('curve-change', { id: props.activeId, key: 'points', value: state.points });
  }
  if (event?.pointerId !== undefined && canvasRef.value.hasPointerCapture(event.pointerId)) canvasRef.value.releasePointerCapture(event.pointerId);
  nextTick(draw);
}

watch(() => props.image?.dataUrl, loadImage);
watch(() => [props.curves, props.activeId, props.tool], draw, { deep: true });

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(stageRef.value);
  loadImage();
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>
