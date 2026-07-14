export const DEFAULT_SNAP_SIZE = 8;

export function createId(prefix = "obj") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normaliseAngle(angle = 0) {
  const value = Number(angle) || 0;
  return ((value % 360) + 360) % 360;
}

export function normaliseObject(object = {}) {
  return {
    id: object.id || createId(object.type || "obj"),
    name: object.name || "",
    type: object.type || "shape",
    x: Number(object.x) || 0,
    y: Number(object.y) || 0,
    width: Math.max(1, Number(object.width) || 1),
    height: Math.max(1, Number(object.height) || 1),
    rotation: normaliseAngle(object.rotation),
    layer: Number.isFinite(Number(object.layer)) ? Number(object.layer) : 0,
    locked: Boolean(object.locked),
    visible: object.visible !== false,
    opacity: Number.isFinite(Number(object.opacity)) ? Number(object.opacity) : 1,
    style: { ...(object.style || {}) },
    data: { ...(object.data || {}) },
    dynamicFieldId: object.dynamicFieldId || null,
  };
}

export function createObject(type, props = {}) {
  return normaliseObject({
    ...props,
    id: props.id || createId(type),
    type,
  });
}

export function moveObject(object, deltaX, deltaY, options = {}) {
  const current = normaliseObject(object);
  if (current.locked) return current;
  const snap = options.snap === false ? null : options.snapSize || DEFAULT_SNAP_SIZE;
  const nextX = current.x + (Number(deltaX) || 0);
  const nextY = current.y + (Number(deltaY) || 0);
  return {
    ...current,
    x: snap ? snapValue(nextX, snap) : nextX,
    y: snap ? snapValue(nextY, snap) : nextY,
  };
}

export function resizeObject(object, width, height, options = {}) {
  const current = normaliseObject(object);
  if (current.locked) return current;
  const minWidth = Number(options.minWidth) || 8;
  const minHeight = Number(options.minHeight) || 8;
  const snap = options.snap === false ? null : options.snapSize || DEFAULT_SNAP_SIZE;
  const nextWidth = Math.max(minWidth, Number(width) || minWidth);
  const nextHeight = Math.max(minHeight, Number(height) || minHeight);
  return {
    ...current,
    width: snap ? snapValue(nextWidth, snap) : nextWidth,
    height: snap ? snapValue(nextHeight, snap) : nextHeight,
  };
}

export function rotateObject(object, angle) {
  const current = normaliseObject(object);
  if (current.locked) return current;
  return {
    ...current,
    rotation: normaliseAngle(angle),
  };
}

export function duplicateObject(object, overrides = {}) {
  const current = normaliseObject(object);
  return normaliseObject({
    ...current,
    ...overrides,
    id: overrides.id || createId(current.type),
    x: Number.isFinite(Number(overrides.x)) ? Number(overrides.x) : current.x + 24,
    y: Number.isFinite(Number(overrides.y)) ? Number(overrides.y) : current.y + 24,
  });
}

export function lockObject(object) {
  return { ...normaliseObject(object), locked: true };
}

export function unlockObject(object) {
  return { ...normaliseObject(object), locked: false };
}

export function snapValue(value, snapSize = DEFAULT_SNAP_SIZE) {
  const size = Math.max(1, Number(snapSize) || DEFAULT_SNAP_SIZE);
  return Math.round((Number(value) || 0) / size) * size;
}

export function snapPoint(point, snapSize = DEFAULT_SNAP_SIZE) {
  return {
    x: snapValue(point?.x, snapSize),
    y: snapValue(point?.y, snapSize),
  };
}
