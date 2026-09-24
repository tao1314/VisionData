/** 曲线像素评分、连续路径搜索与结果清理工具。 */

const REFERENCE_WHITE = { x: 95.047, y: 100, z: 108.883 };

/** 将十六进制颜色转换为 RGB。 */
function hexToRgb(color) {
  const normalized = String(color || '#000000').replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

/** 将 RGB 通道转换为 XYZ 使用的线性值。 */
function linearizeChannel(value) {
  const normalized = value / 255;
  return normalized > 0.04045 ? ((normalized + 0.055) / 1.055) ** 2.4 : normalized / 12.92;
}

/** 将 RGB 颜色转换为 Lab，便于按人眼感知计算颜色距离。 */
function rgbToLab({ r, g, b }) {
  const red = linearizeChannel(r);
  const green = linearizeChannel(g);
  const blue = linearizeChannel(b);
  const xyz = {
    x: (red * 0.4124 + green * 0.3576 + blue * 0.1805) * 100 / REFERENCE_WHITE.x,
    y: (red * 0.2126 + green * 0.7152 + blue * 0.0722) * 100 / REFERENCE_WHITE.y,
    z: (red * 0.0193 + green * 0.1192 + blue * 0.9505) * 100 / REFERENCE_WHITE.z
  };
  /** 将 XYZ 分量转换为 Lab 分量。 */
  const pivot = (value) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const x = pivot(xyz.x);
  const y = pivot(xyz.y);
  const z = pivot(xyz.z);
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** 读取图像中指定位置的 RGB 颜色。 */
function readRgb(imageData, x, y) {
  const safeX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const safeY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const index = (safeY * imageData.width + safeX) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2]
  };
}

/** 计算弱化明暗差异、强调色相一致性的感知颜色距离。 */
function labDistance(first, second) {
  const firstChroma = Math.hypot(first.a, first.b);
  const secondChroma = Math.hypot(second.a, second.b);
  const lightnessDelta = first.l - second.l;
  const chromaDelta = firstChroma - secondChroma;
  const hueDelta = Math.sqrt(Math.max(0, (first.a - second.a) ** 2 + (first.b - second.b) ** 2 - chromaDelta ** 2));
  if (secondChroma < 10) return Math.hypot(lightnessDelta * 0.55, first.a - second.a, first.b - second.b);
  return Math.hypot(lightnessDelta * 0.18, chromaDelta * 0.25, hueDelta * 0.85);
}

/** 计算像素与目标曲线颜色的距离。 */
function colorDistance(imageData, x, y, targetLab) {
  return labDistance(rgbToLab(readRgb(imageData, x, y)), targetLab);
}

/** 计算像素周围的灰度梯度，作为弱线条特征。 */
function pixelGradient(imageData, x, y) {
  /** 将 RGB 转换为感知亮度。 */
  const luminance = (rgb) => rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  return Math.abs(luminance(readRgb(imageData, x + 1, y)) - luminance(readRgb(imageData, x - 1, y)))
    + Math.abs(luminance(readRgb(imageData, x, y + 1)) - luminance(readRgb(imageData, x, y - 1)));
}

/** 计算候选像素的数据代价，颜色为主、边缘为辅。 */
function pixelCost(imageData, x, y, targetLab) {
  return colorDistance(imageData, x, y, targetLab) - Math.min(pixelGradient(imageData, x, y), 120) * 0.035;
}

/** 从单列中提取相互分离的低代价候选点。 */
function collectColumnCandidates(imageData, x, top, bottom, targetLab, limit = 9) {
  const candidates = [];
  const costs = [];
  for (let y = top; y <= bottom; y += 1) {
    costs.push(pixelCost(imageData, x, y, targetLab));
  }
  for (let index = 0; index < costs.length; index += 1) {
    const cost = costs[index];
    if (cost <= (costs[index - 1] ?? cost) && cost <= (costs[index + 1] ?? cost)) {
      candidates.push({ x, y: top + index, dataCost: cost });
    }
  }
  candidates.sort((first, second) => first.dataCost - second.dataCost);
  return candidates
    .filter((candidate, index, items) => items.slice(0, index).every((item) => Math.abs(item.y - candidate.y) >= 3))
    .slice(0, limit);
}

/** 使用动态规划从多列候选点中搜索最连续的曲线路径。 */
function findContinuousPath(columns) {
  if (!columns.length || columns.some((column) => !column.length)) return [];
  const costs = columns.map((column) => column.map(() => Number.POSITIVE_INFINITY));
  const parents = columns.map((column) => column.map(() => -1));
  columns[0].forEach((candidate, index) => { costs[0][index] = candidate.dataCost; });

  for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
    columns[columnIndex].forEach((candidate, candidateIndex) => {
      columns[columnIndex - 1].forEach((previous, previousIndex) => {
        const deltaY = Math.abs(candidate.y - previous.y);
        const transitionCost = deltaY * 1.35 + Math.max(0, deltaY - 8) ** 2 * 0.45;
        const totalCost = costs[columnIndex - 1][previousIndex] + candidate.dataCost + transitionCost;
        if (totalCost < costs[columnIndex][candidateIndex]) {
          costs[columnIndex][candidateIndex] = totalCost;
          parents[columnIndex][candidateIndex] = previousIndex;
        }
      });
    });
  }

  let candidateIndex = costs.at(-1).indexOf(Math.min(...costs.at(-1)));
  const path = [];
  for (let columnIndex = columns.length - 1; columnIndex >= 0; columnIndex -= 1) {
    path.push(columns[columnIndex][candidateIndex]);
    candidateIndex = parents[columnIndex][candidateIndex];
  }
  return path.reverse().map(({ x, y }) => ({ x, y }));
}

/** 使用中值约束削弱孤立跳点，同时保留持续存在的峰谷。 */
function smoothPath(points) {
  if (points.length < 5) return points;
  return points.map((point, index) => {
    const neighbors = points.slice(Math.max(0, index - 2), index + 3).map((item) => item.y).sort((a, b) => a - b);
    const median = neighbors[Math.floor(neighbors.length / 2)];
    return { x: point.x, y: Math.abs(point.y - median) > 5 ? median : point.y };
  });
}

/** 在框选区域内按目标颜色提取一条连续曲线路径。 */
export function extractCurvePath(imageData, start, end, targetColor, maxPoints = 260) {
  if (!imageData) return [];
  const left = Math.max(1, Math.round(Math.min(start.x, end.x)));
  const right = Math.min(imageData.width - 2, Math.round(Math.max(start.x, end.x)));
  const top = Math.max(1, Math.round(Math.min(start.y, end.y)));
  const bottom = Math.min(imageData.height - 2, Math.round(Math.max(start.y, end.y)));
  if (right <= left || bottom <= top) return [];
  const step = Math.max(1, Math.ceil((right - left) / maxPoints));
  const targetLab = rgbToLab(hexToRgb(targetColor));
  const columns = [];
  for (let x = left; x <= right; x += step) columns.push(collectColumnCandidates(imageData, x, top, bottom, targetLab));
  return smoothPath(findContinuousPath(columns));
}

/** 在窄轨迹走廊内结合颜色、鼠标引导和前进方向寻找吸附点。 */
export function findCurveSnap(imageData, point, targetColor, previousPoints = [], guidePoints = [], radius = 7) {
  if (!imageData) return point;
  const targetLab = rgbToLab(hexToRgb(targetColor));
  const centerX = Math.round(point.x);
  const centerY = Math.round(point.y);
  const previous = previousPoints.at(-1);
  const beforePrevious = previousPoints.at(-2);
  const previousGuide = guidePoints.at(-1);
  const guideDelta = previousGuide ? { x: point.x - previousGuide.x, y: point.y - previousGuide.y } : null;
  const predicted = previous && guideDelta
    ? { x: previous.x + guideDelta.x, y: previous.y + guideDelta.y }
    : previous;
  const allowedJump = guideDelta ? Math.max(radius * 1.6, Math.hypot(guideDelta.x, guideDelta.y) * 1.8 + 2) : radius * 1.6;
  let best = point;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 1 || y < 1 || x >= imageData.width - 1 || y >= imageData.height - 1) continue;
      const pointerDistance = Math.hypot(x - centerX, y - centerY);
      const jumpDistance = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
      if (previous && jumpDistance > allowedJump) continue;
      let directionPenalty = 0;
      if (predicted) {
        directionPenalty += Math.hypot(x - predicted.x, y - predicted.y) * 1.15;
      }
      if (!guideDelta && previous && beforePrevious) {
        const expected = { x: previous.x - beforePrevious.x, y: previous.y - beforePrevious.y };
        directionPenalty += Math.hypot(x - previous.x - expected.x, y - previous.y - expected.y) * 0.85;
      }
      const cost = pixelCost(imageData, x, y, targetLab) + pointerDistance * 1.25 + jumpDistance * 0.35 + directionPenalty;
      if (cost < bestCost) {
        bestCost = cost;
        best = { x, y };
      }
    }
  }
  return best;
}

/** 读取原图像素并返回颜色选择器可用的十六进制颜色。 */
export function pickPixelColor(imageData, point) {
  if (!imageData) return '#000000';
  const { r, g, b } = readRgb(imageData, point.x, point.y);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/** 合并新旧曲线点，按原图像素位置去重并保留原始描绘顺序。 */
export function mergeCurvePoints(existingPoints = [], incomingPoints = []) {
  const uniquePoints = [];
  const pixelKeys = new Set();
  for (const point of [...existingPoints, ...incomingPoints]) {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    if (pixelKeys.has(key)) continue;
    pixelKeys.add(key);
    uniquePoints.push(point);
  }
  return uniquePoints;
}
