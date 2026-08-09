// A minimal pdfjs-PageViewport-compatible fake that supports the 4 cardinal
// rotations, for tests that need to prove calibration/measurement/area
// calculations are unaffected by rotation, zoom or pan. Self-consistent
// (convertToPdfPoint is the exact inverse of convertToViewportPoint) for all
// four rotation values.
export function makeRotatingViewport({ width, height, rotation = 0, scale = 1 }) {
  function toViewport(x, y) {
    switch (rotation) {
      case 90: return [(height - y) * scale, x * scale];
      case 180: return [(width - x) * scale, (height - y) * scale];
      case 270: return [y * scale, (width - x) * scale];
      default: return [x * scale, y * scale];
    }
  }
  function toPdf(u, v) {
    const su = u / scale;
    const sv = v / scale;
    switch (rotation) {
      case 90: return [sv, height - su];
      case 180: return [width - su, height - sv];
      case 270: return [width - sv, su];
      default: return [su, sv];
    }
  }
  const sideways = rotation === 90 || rotation === 270;
  return {
    convertToViewportPoint: toViewport,
    convertToPdfPoint: toPdf,
    width: (sideways ? height : width) * scale,
    height: (sideways ? width : height) * scale,
  };
}
