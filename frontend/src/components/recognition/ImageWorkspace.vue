<template>
  <section ref="stageRef" class="image-stage" :class="`tool-${tool}`">
    <canvas
      v-show="image"
      ref="canvasRef"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerUp"
      @wheel.prevent="handleWheel"
    ></canvas>
    <el-empty v-if="!image" description="请先导入需要识别的图片" :image-size="120" />
    <footer v-if="image" class="image-stage-footer">
      <div class="zoom-controls">
        <el-button size="small" :disabled="!canZoomOut" @click="zoomOut">−</el-button>
        <span>{{ zoomText }}</span>
        <el-button size="small" :disabled="!canZoomIn" @click="zoomIn">＋</el-button>
        <el-button size="small" @click="resetZoom">适应</el-button>
      </div>
      <div class="stage-status">
        <span>{{ image.name }}</span>
        <span>{{ imageSize }}</span>
        <span>{{ toolHint }}</span>
        <span>滚轮缩放 · 空格拖动</span>
      </div>
    </footer>
  </section>
</template>

<script setup>
/** 图片绘制、坐标轴标定、框选识别与吸附描线画布。 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CURVE_COLOR_TOLERANCE, extractCurvePath, findCurveSnap, mergeCurvePoints, pickColorProfile } from '@/utils/curveRecognition';

const props = defineProps({
  image: { type: Object, default: null },
  curves: { type: Array, required: true },
  activeId: { type: Number, required: true },
  tool: { type: String, default: 'trace' }
});

const emit = defineEmits(['curve-change', 'tool-complete']);
const stageRef = ref();
const canvasRef = ref();
const sourceImage = new Image();
const offscreen = document.createElement('canvas');
const STAGE_FOOTER_HEIGHT = 50;
const view = { scale: 1, minScale: 1, offsetX: 0, offsetY: 0, initialized: false };
const drag = ref(null);
const pan = ref(null);
const isSpacePressed = ref(false);
const imageDimensions = ref({ width: 0, height: 0 });
let resizeObserver;
let sourcePixels = null;

const activeCurve = computed(() => props.curves.find((curve) => curve.id === props.activeId));
const imageSize = computed(() => imageDimensions.value.width ? `${imageDimensions.value.width} × ${imageDimensions.value.height}px` : '读取中');
const zoomRatio = ref(1);
const zoomText = computed(() => `${Math.round(zoomRatio.value * 100)}%`);
const canZoomOut = computed(() => zoomRatio.value > 1.001);
const canZoomIn = computed(() => zoomRatio.value < 8);
const toolHint = computed(() => ({
  box: '拖动框选曲线区域',
  trace: '按住并沿曲线描绘，自动吸附',
  'color-picker': '点击图片中的曲线拾取颜色',
  'x-axis': '第一次点击确定起点，第二次点击确定终点',
  'y-axis': '第一次点击确定起点，第二次点击确定终点'
}[props.tool] || '选择工具'));

/** 加载当前图片并缓存像素数据供吸附算法使用。 */
function loadImage() {
  sourcePixels = null;
  view.initialized = false;
  zoomRatio.value = 1;
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
    resizeCanvas();
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
  const height = Math.max(stage.clientHeight - (props.image ? STAGE_FOOTER_HEIGHT : 0), 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  view.initialized = false;
  zoomRatio.value = 1;
  draw();
}

/** 将图片恢复为导入时上下边缘贴合画布的适应比例。 */
function fitImageToCanvas(width, height) {
  view.minScale = height / sourceImage.naturalHeight;
  view.scale = view.minScale;
  view.offsetX = (width - sourceImage.naturalWidth * view.scale) / 2;
  view.offsetY = 0;
  view.initialized = true;
  zoomRatio.value = 1;
}

/** 限制平移范围，避免放大后把图片完全拖出画布。 */
function clampViewOffset() {
  const canvas = canvasRef.value;
  if (!canvas || !sourceImage.naturalWidth) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const imageWidth = sourceImage.naturalWidth * view.scale;
  const imageHeight = sourceImage.naturalHeight * view.scale;
  view.offsetX = imageWidth <= width
    ? (width - imageWidth) / 2
    : Math.max(width - imageWidth, Math.min(0, view.offsetX));
  view.offsetY = imageHeight <= height
    ? (height - imageHeight) / 2
    : Math.max(height - imageHeight, Math.min(0, view.offsetY));
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

  if (!view.initialized) fitImageToCanvas(width, height);
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
  if (active) {
    drawAxis(context, curve.xAxis, '#15a6d8', 'X');
    drawAxis(context, curve.yAxis, '#16a36a', 'Y');
  }
  if (curve.selectionBox) {
    const start = toCanvasPoint(curve.selectionBox.start);
    const end = toCanvasPoint(curve.selectionBox.end);
    context.strokeStyle = curve.color;
    context.setLineDash([6, 4]);
    context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    context.setLineDash([]);
  }
  if (curve.points.length) {
    const segments = curve.segments?.length ? curve.segments : [curve.points];
    for (const segment of segments) drawPointPath(context, segment, curve.color, active);
  }
  context.restore();
}

/** 使用黑白轮廓和独立标注色绘制清晰可见的识别路径。 */
function drawPointPath(context, points, color, active = true) {
  context.save();
  context.beginPath();
  points.forEach((point, index) => {
    const position = toCanvasPoint(point);
    index ? context.lineTo(position.x, position.y) : context.moveTo(position.x, position.y);
  });
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(17, 24, 39, .82)';
  context.lineWidth = active ? 6 : 4.5;
  context.stroke();
  context.strokeStyle = 'rgba(255, 255, 255, .95)';
  context.lineWidth = active ? 4.2 : 3;
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = active ? 2.4 : 1.6;
  context.stroke();
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
    drawPointPath(context, state.points, activeCurve.value?.color || '#3976e6');
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

/** 以指定画布位置为中心设置缩放比例，并保证不小于初始适应比例。 */
function setZoom(nextRatio, anchor = null) {
  if (!sourceImage.naturalWidth || !canvasRef.value) return;
  const boundedRatio = Math.max(1, Math.min(8, nextRatio));
  const bounds = canvasRef.value.getBoundingClientRect();
  const center = anchor || { x: bounds.width / 2, y: bounds.height / 2 };
  const imagePoint = {
    x: (center.x - view.offsetX) / view.scale,
    y: (center.y - view.offsetY) / view.scale
  };
  view.scale = view.minScale * boundedRatio;
  view.offsetX = center.x - imagePoint.x * view.scale;
  view.offsetY = center.y - imagePoint.y * view.scale;
  zoomRatio.value = boundedRatio;
  clampViewOffset();
  draw();
}

/** 放大一级当前图片。 */
function zoomIn() {
  setZoom(zoomRatio.value * 1.25);
}

/** 缩小一级当前图片，但不低于初始显示比例。 */
function zoomOut() {
  setZoom(zoomRatio.value / 1.25);
}

/** 恢复图片导入后的高度适应比例。 */
function resetZoom() {
  view.initialized = false;
  draw();
}

/** 根据滚轮方向围绕鼠标位置缩放图片。 */
function handleWheel(event) {
  const bounds = canvasRef.value.getBoundingClientRect();
  const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  setZoom(zoomRatio.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15), anchor);
}

/** 根据落笔位置判断是否从已有曲线的首端或尾端继续描线。 */
function getTraceContinuation(point) {
  const points = activeCurve.value?.points || [];
  if (!points.length) return { mode: 'replace', basePoints: [], seedPoints: [] };
  const threshold = Math.max(4, 24 / view.scale);
  const firstDistance = Math.hypot(point.x - points[0].x, point.y - points[0].y);
  const lastDistance = Math.hypot(point.x - points.at(-1).x, point.y - points.at(-1).y);
  if (lastDistance <= threshold && lastDistance <= firstDistance) {
    return { mode: 'append', basePoints: [...points], seedPoints: points.slice(-2) };
  }
  if (firstDistance <= threshold) {
    return { mode: 'prepend', basePoints: [...points], seedPoints: points.slice(0, 2).reverse() };
  }
  return { mode: 'merge', basePoints: [...points], seedPoints: [] };
}

/** 读取已有识别分段，并兼容只有扁平点集的旧数据。 */
function getCurveSegments(curve) {
  if (curve?.segments?.length) return curve.segments.map((segment) => [...segment]);
  return curve?.points?.length ? [[...curve.points]] : [];
}

/** 将新描线按续接方向写入对应分段，避免不同描绘批次相互连线。 */
function mergeTraceSegments(state) {
  const segments = state.baseSegments.map((segment) => [...segment]);
  const mergedPoints = mergeCurvePoints(state.basePoints, state.points);
  const uniqueIncoming = mergedPoints.slice(state.basePoints.length);
  if (!segments.length) return state.points.length ? [[...state.points]] : [];
  if (state.traceJoin === 'append') {
    segments[segments.length - 1] = mergeCurvePoints(segments.at(-1), state.points);
  } else if (state.traceJoin === 'prepend') {
    segments[0] = mergeCurvePoints([...state.points].reverse(), segments[0]);
  } else if (uniqueIncoming.length) {
    segments.push(uniqueIncoming);
  }
  return segments;
}

/** 将多个识别分段展开为去重后的导出点集。 */
function flattenCurveSegments(segments) {
  return segments.reduce((points, segment) => mergeCurvePoints(points, segment), []);
}

/** 将框选结果作为独立分段追加，并移除与已有结果重复的像素点。 */
function appendBoxSegment(curve, extractedPoints) {
  const segments = getCurveSegments(curve);
  const mergedPoints = mergeCurvePoints(curve.points, extractedPoints);
  const uniqueIncoming = mergedPoints.slice(curve.points.length);
  if (uniqueIncoming.length) segments.push(uniqueIncoming);
  return { points: mergedPoints, segments };
}

/** 记录空格键状态，用于临时切换画布拖动。 */
function handleKeyDown(event) {
  if (event.code !== 'Space' || isEditableElement(event.target)) return;
  event.preventDefault();
  isSpacePressed.value = true;
}

/** 结束空格键触发的临时画布拖动状态。 */
function handleKeyUp(event) {
  if (event.code !== 'Space' || isEditableElement(event.target)) return;
  event.preventDefault();
  isSpacePressed.value = false;
}

/** 判断键盘事件是否来自需要正常输入空格的编辑控件。 */
function isEditableElement(target) {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, [contenteditable="true"]') || Boolean(target.closest('[contenteditable="true"]')));
}

/** 获取当前数据线的多像素识别颜色样本。 */
function getRecognitionColors() {
  if (activeCurve.value?.targetColors?.length) return activeCurve.value.targetColors;
  return [activeCurve.value?.targetColor || activeCurve.value?.color].filter(Boolean);
}

/** 判断当前工具是否为两次点击完成的坐标轴标注工具。 */
function isAxisTool(tool) {
  return tool === 'x-axis' || tool === 'y-axis';
}

/** 提交坐标轴终点，并恢复当前数据线的曲线选取工具。 */
function completeAxisSelection(state, end) {
  emit('curve-change', {
    id: props.activeId,
    key: state.tool === 'x-axis' ? 'xAxis' : 'yAxis',
    value: { start: state.start, end }
  });
  drag.value = null;
  emit('tool-complete', activeCurve.value.mode);
  nextTick(draw);
}

/** 开始坐标轴、框选或吸附描线操作。 */
function handlePointerDown(event) {
  if (!props.image || !activeCurve.value) return;
  if (event.button === 1 || isSpacePressed.value) {
    event.preventDefault();
    canvasRef.value.setPointerCapture(event.pointerId);
    pan.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    return;
  }
  const point = toImagePoint(event);
  if (props.tool === 'color-picker') {
    const profile = pickColorProfile(sourcePixels, point);
    emit('curve-change', { id: props.activeId, key: 'targetColor', value: profile.color });
    emit('curve-change', { id: props.activeId, key: 'targetColors', value: profile.colors });
    emit('tool-complete', activeCurve.value.mode);
    return;
  }
  if (isAxisTool(props.tool)) {
    if (drag.value?.tool === props.tool && drag.value.awaitingSecondClick) {
      completeAxisSelection(drag.value, point);
    } else {
      drag.value = {
        tool: props.tool,
        start: point,
        current: point,
        awaitingSecondClick: true
      };
      draw();
    }
    return;
  }
  canvasRef.value.setPointerCapture(event.pointerId);
  const continuation = props.tool === 'trace'
    ? getTraceContinuation(point)
    : { mode: 'replace', basePoints: [], seedPoints: [] };
  const firstSnap = props.tool === 'trace'
    ? findCurveSnap(
      sourcePixels,
      point,
      getRecognitionColors(),
      continuation.seedPoints,
      [],
      7,
      CURVE_COLOR_TOLERANCE
    )
    : null;
  const points = firstSnap ? [firstSnap] : [];
  drag.value = {
    tool: props.tool,
    start: point,
    current: point,
    points,
    guidePoints: props.tool === 'trace' ? [point] : [],
    traceJoin: continuation.mode,
    traceSeed: continuation.seedPoints,
    basePoints: continuation.basePoints,
    baseSegments: getCurveSegments(activeCurve.value)
  };
  draw();
}

/** 更新当前操作位置，并持续采样吸附描线点。 */
function handlePointerMove(event) {
  if (pan.value) {
    view.offsetX += event.clientX - pan.value.x;
    view.offsetY += event.clientY - pan.value.y;
    pan.value = { ...pan.value, x: event.clientX, y: event.clientY };
    clampViewOffset();
    draw();
    return;
  }
  if (!drag.value) return;
  const point = toImagePoint(event);
  drag.value.current = point;
  if (drag.value.tool === 'trace') {
    const snapped = findCurveSnap(
      sourcePixels,
      point,
      getRecognitionColors(),
      [...drag.value.traceSeed, ...drag.value.points],
      drag.value.guidePoints,
      7,
      CURVE_COLOR_TOLERANCE
    );
    if (!snapped) {
      draw();
      return;
    }
    const previous = drag.value.points.at(-1);
    if (!previous || Math.hypot(snapped.x - previous.x, snapped.y - previous.y) >= 2) {
      drag.value.points.push(snapped);
      drag.value.guidePoints.push(point);
    }
  }
  draw();
}

/** 处理指针松开，并提交仍采用拖动模式的操作结果。 */
function handlePointerUp(event) {
  if (pan.value) {
    pan.value = null;
    if (event?.pointerId !== undefined && canvasRef.value.hasPointerCapture(event.pointerId)) canvasRef.value.releasePointerCapture(event.pointerId);
    return;
  }
  if (!drag.value || !activeCurve.value) return;
  if (isAxisTool(drag.value.tool) && drag.value.awaitingSecondClick) {
    if (event?.pointerId !== undefined && canvasRef.value.hasPointerCapture(event.pointerId)) canvasRef.value.releasePointerCapture(event.pointerId);
    return;
  }
  const state = drag.value;
  drag.value = null;
  if (state.tool === 'box') {
    const extractedPoints = extractCurvePath(
      sourcePixels,
      state.start,
      state.current,
      getRecognitionColors(),
      260,
      CURVE_COLOR_TOLERANCE
    );
    const result = appendBoxSegment(activeCurve.value, extractedPoints);
    emit('curve-change', { id: props.activeId, key: 'selectionBox', value: { start: state.start, end: state.current } });
    emit('curve-change', { id: props.activeId, key: 'segments', value: result.segments });
    emit('curve-change', {
      id: props.activeId,
      key: 'points',
      value: result.points
    });
  } else if (state.tool === 'trace' && state.points.length) {
    const segments = mergeTraceSegments(state);
    emit('curve-change', { id: props.activeId, key: 'segments', value: segments });
    emit('curve-change', { id: props.activeId, key: 'points', value: flattenCurveSegments(segments) });
  }
  if (event?.pointerId !== undefined && canvasRef.value.hasPointerCapture(event.pointerId)) canvasRef.value.releasePointerCapture(event.pointerId);
  nextTick(draw);
}

watch(() => props.image?.dataUrl, loadImage);
/** 数据线内容变化时重绘画布。 */
watch(() => props.curves, draw, { deep: true });
/** 切换数据线时取消尚未完成的两次点击标注。 */
watch(() => props.activeId, () => {
  drag.value = null;
  draw();
});
/** 切换工具时清除不属于新工具的操作预览。 */
watch(() => props.tool, (tool) => {
  if (drag.value && drag.value.tool !== tool) drag.value = null;
  draw();
});

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(stageRef.value);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  loadImage();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('keyup', handleKeyUp, true);
});
</script>
