import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateFitView,
  createViewState,
  imageToScreenPoint as fallbackImageToScreenPoint,
  screenToImagePoint as fallbackScreenToImagePoint,
} from "../core/viewTransform.js";
import { buildSnapPointsFromSegments, createSegmentsFromPage, snapPoint } from "../core/snapping.js";

const TILE_SIZE = 256;

export function getRelativePointerPoint(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function calculateInitialViewerState({ containerWidth, containerHeight, imageWidth, imageHeight }) {
  return calculateFitView({
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    padding: 24,
  });
}

function loadOpenSeadragon() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenSeadragon requires a browser"));
  }
  return import("openseadragon").then((module) => module.default || module);
}

function loadRasterImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode raster image"));
    image.src = src;
  });
}

function getLevelScale(level, maxLevel) {
  return 1 / 2 ** (maxLevel - level);
}

function getLevelSize(width, height, level, maxLevel) {
  const scale = getLevelScale(level, maxLevel);
  return {
    width: Math.max(1, Math.ceil(width * scale)),
    height: Math.max(1, Math.ceil(height * scale)),
  };
}

function canvasToObjectUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate plan tile"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function releaseTilePyramid(tilePyramid) {
  if (!tilePyramid?.tileUrls) {
    return;
  }
  tilePyramid.tileUrls.forEach((url) => URL.revokeObjectURL(url));
}

async function generateTilePyramid({ imageDataUrl, imageWidth, imageHeight, onProgress }) {
  const image = await loadRasterImage(imageDataUrl);
  const width = Number(imageWidth || image.naturalWidth || image.width || 0);
  const height = Number(imageHeight || image.naturalHeight || image.height || 0);
  const maxLevel = Math.ceil(Math.log2(Math.max(width, height)));
  const minLevel = 0;
  const levelSummaries = [];
  const tileUrls = new Map();
  let totalTiles = 0;

  for (let level = minLevel; level <= maxLevel; level += 1) {
    const levelSize = getLevelSize(width, height, level, maxLevel);
    const columns = Math.ceil(levelSize.width / TILE_SIZE);
    const rows = Math.ceil(levelSize.height / TILE_SIZE);
    const tiles = columns * rows;
    totalTiles += tiles;
    levelSummaries.push({ level, ...levelSize, columns, rows, tiles });
  }

  const tileCanvas = document.createElement("canvas");
  const tileContext = tileCanvas.getContext("2d", { alpha: false });
  if (!tileContext) {
    throw new Error("Canvas tile renderer is unavailable");
  }

  let generatedTiles = 0;
  for (const summary of levelSummaries) {
    const levelScale = getLevelScale(summary.level, maxLevel);
    for (let y = 0; y < summary.rows; y += 1) {
      for (let x = 0; x < summary.columns; x += 1) {
        const tileWidth = Math.min(TILE_SIZE, summary.width - x * TILE_SIZE);
        const tileHeight = Math.min(TILE_SIZE, summary.height - y * TILE_SIZE);
        tileCanvas.width = tileWidth;
        tileCanvas.height = tileHeight;
        tileContext.fillStyle = "#ffffff";
        tileContext.fillRect(0, 0, tileWidth, tileHeight);
        tileContext.imageSmoothingEnabled = true;
        tileContext.imageSmoothingQuality = "high";
        tileContext.drawImage(
          image,
          (x * TILE_SIZE) / levelScale,
          (y * TILE_SIZE) / levelScale,
          tileWidth / levelScale,
          tileHeight / levelScale,
          0,
          0,
          tileWidth,
          tileHeight,
        );
        tileUrls.set(`${summary.level}/${x}_${y}`, await canvasToObjectUrl(tileCanvas));
        generatedTiles += 1;

        if (generatedTiles % 16 === 0 || generatedTiles === totalTiles) {
          onProgress?.({ generatedTiles, totalTiles, percent: Math.round((generatedTiles / totalTiles) * 100) });
          await new Promise((resolve) => window.requestAnimationFrame(resolve));
        }
      }
    }
  }

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    minLevel,
    maxLevel,
    levelSummaries,
    tileUrls,
    totalTiles,
    getTileUrl(level, x, y) {
      return tileUrls.get(`${level}/${x}_${y}`) || "";
    },
  };
}

function createTileSource(tilePyramid) {
  return {
    width: tilePyramid.width,
    height: tilePyramid.height,
    tileSize: tilePyramid.tileSize,
    minLevel: tilePyramid.minLevel,
    maxLevel: tilePyramid.maxLevel,
    getTileUrl(level, x, y) {
      return tilePyramid.getTileUrl(level, x, y);
    },
  };
}

function getImageZoomFromViewer(viewer) {
  if (!viewer?.viewport) {
    return 1;
  }
  if (typeof viewer.viewport.viewportToImageZoom === "function") {
    return viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom(true));
  }
  const a = viewer.viewport.imageToViewerElementCoordinates({ x: 0, y: 0 });
  const b = viewer.viewport.imageToViewerElementCoordinates({ x: 100, y: 0 });
  return Math.abs((b.x - a.x) / 100) || 1;
}

function getViewStateFromViewer(viewer) {
  const zoom = getImageZoomFromViewer(viewer);
  const origin = viewer.viewport.imageToViewerElementCoordinates({ x: 0, y: 0 });
  return createViewState({
    zoom,
    panX: origin.x,
    panY: origin.y,
  });
}

function zoomViewerToImageZoom(viewer, imageZoom) {
  if (!viewer?.viewport) {
    return;
  }
  if (typeof viewer.viewport.imageToViewportZoom === "function") {
    viewer.viewport.zoomTo(viewer.viewport.imageToViewportZoom(imageZoom), null, false);
    return;
  }
  viewer.viewport.zoomTo(imageZoom, null, false);
}

function applyViewStateToViewer(viewer, viewState, containerElement) {
  if (!viewer?.viewport || !viewState) {
    return;
  }
  const view = createViewState(viewState);
  zoomViewerToImageZoom(viewer, view.zoom);
  const rect = containerElement?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const centerImagePoint = {
    x: ((rect.width || 0) / 2 - view.panX) / Math.max(view.zoom, 0.0001),
    y: ((rect.height || 0) / 2 - view.panY) / Math.max(view.zoom, 0.0001),
  };
  viewer.viewport.panTo(viewer.viewport.imageToViewportCoordinates(centerImagePoint), true);
}

export default function TakeoffCanvas({
  page,
  viewState,
  activeTool,
  scaleDraft,
  measureDraft,
  areaDraft,
  snapEnabled = true,
  onViewStateChange,
  onImageClick,
  onImageDoubleClick,
  fitRequestKey = 0,
  fitRequestMode = "fit-page",
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const tilePyramidRef = useRef(null);
  const [OpenSeadragonLib, setOpenSeadragonLib] = useState(null);
  const [tilePyramid, setTilePyramid] = useState(null);
  const [tileProgress, setTileProgress] = useState(null);
  const [tileError, setTileError] = useState("");
  const [overlayTick, setOverlayTick] = useState(0);
  const [snapMarker, setSnapMarker] = useState(null);

  const imageWidth = page?.imageWidth || 0;
  const imageHeight = page?.imageHeight || 0;
  const currentView = createViewState(viewState);
  const snapPoints = useMemo(() => buildSnapPointsFromSegments(createSegmentsFromPage(page || {}, {
    scaleDraft,
    measureDraft,
    areaDraft,
  })), [page, scaleDraft, measureDraft, areaDraft]);

  useEffect(() => {
    let alive = true;
    loadOpenSeadragon()
      .then((library) => {
        if (alive) {
          setOpenSeadragonLib(library);
        }
      })
      .catch((error) => setTileError(error.message || "Failed to load tiled viewer"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!page?.imageDataUrl) {
      releaseTilePyramid(tilePyramidRef.current);
      tilePyramidRef.current = null;
      setTilePyramid(null);
      return undefined;
    }

    setTileError("");
    setTileProgress({ generatedTiles: 0, totalTiles: 0, percent: 0 });
    generateTilePyramid({
      imageDataUrl: page.imageDataUrl,
      imageWidth,
      imageHeight,
      onProgress: (progress) => !cancelled && setTileProgress(progress),
    })
      .then((nextPyramid) => {
        if (cancelled) {
          releaseTilePyramid(nextPyramid);
          return;
        }
        releaseTilePyramid(tilePyramidRef.current);
        tilePyramidRef.current = nextPyramid;
        setTilePyramid(nextPyramid);
        setTileProgress(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setTileProgress(null);
          setTileError(error.message || "Tile generation failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page?.id, page?.imageDataUrl, imageWidth, imageHeight]);

  useEffect(() => {
    return () => {
      releaseTilePyramid(tilePyramidRef.current);
    };
  }, []);

  useEffect(() => {
    if (!OpenSeadragonLib || !containerRef.current || !tilePyramid) {
      return undefined;
    }

    viewerRef.current?.destroy?.();
    const viewer = OpenSeadragonLib({
      element: containerRef.current,
      prefixUrl: "",
      showNavigator: true,
      showNavigationControl: false,
      animationTime: 0.12,
      springStiffness: 9.5,
      blendTime: 0,
      minZoomImageRatio: 0.03,
      maxZoomPixelRatio: 12,
      visibilityRatio: 0.02,
      constrainDuringPan: false,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: false,
        flickEnabled: true,
        scrollToZoom: true,
      },
      tileSources: createTileSource(tilePyramid),
    });

    viewerRef.current = viewer;

    function syncViewState() {
      if (!viewerRef.current?.viewport) {
        return;
      }
      setOverlayTick((value) => value + 1);
      onViewStateChange?.(getViewStateFromViewer(viewerRef.current));
    }

    viewer.addHandler("open", () => {
      if (page?.viewState) {
        applyViewStateToViewer(viewer, currentView, containerRef.current);
      } else {
        viewer.viewport.goHome(true);
      }
      syncViewState();
    });
    viewer.addHandler("animation", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("animation-finish", syncViewState);
    viewer.addHandler("resize", syncViewState);
    viewer.addHandler("tile-loaded", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("canvas-click", (event) => {
      if (!event.quick || !event.position) {
        return;
      }
      if (activeTool !== "scale" && activeTool !== "measure" && activeTool !== "area") {
        return;
      }
      const imagePoint = viewer.viewport.viewerElementToImageCoordinates(event.position);
      const snapped = snapPoint(
        { x: imagePoint.x, y: imagePoint.y },
        snapPoints,
        {
          enabled: snapEnabled,
          tolerancePx: 14 / Math.max(getImageZoomFromViewer(viewer), 0.0001),
        },
      );
      onImageClick?.(snapped.point);
    });
    viewer.addHandler("canvas-double-click", (event) => {
      if (activeTool === "area") {
        event.preventDefaultAction = true;
        onImageDoubleClick?.();
      }
    });

    return () => {
      viewer.destroy();
      if (viewerRef.current === viewer) {
        viewerRef.current = null;
      }
    };
  }, [OpenSeadragonLib, tilePyramid, page?.id, activeTool, snapEnabled, snapPoints]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const element = containerRef.current;
    if (!viewer?.viewport || !element) {
      return undefined;
    }

    function handleMouseMove(event) {
      if (activeTool !== "scale" && activeTool !== "measure" && activeTool !== "area") {
        setSnapMarker(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const screenPoint = new OpenSeadragonLib.Point(event.clientX - rect.left, event.clientY - rect.top);
      const imagePoint = viewer.viewport.viewerElementToImageCoordinates(screenPoint);
      const snapped = snapPoint(
        { x: imagePoint.x, y: imagePoint.y },
        snapPoints,
        {
          enabled: snapEnabled,
          tolerancePx: 14 / Math.max(getImageZoomFromViewer(viewer), 0.0001),
        },
      );
      setSnapMarker(snapped.snapped ? snapped.snap.point : null);
    }

    function handleMouseLeave() {
      setSnapMarker(null);
    }

    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [OpenSeadragonLib, activeTool, snapEnabled, snapPoints]);

  useEffect(() => {
    if (!fitRequestKey || !viewerRef.current?.viewport) {
      return;
    }
    if (fitRequestMode === "fit-width") {
      const rect = containerRef.current?.getBoundingClientRect?.() || { width: 0 };
      const nextZoom = Math.max(0.0001, Number(rect.width || 0) / Math.max(1, imageWidth));
      zoomViewerToImageZoom(viewerRef.current, nextZoom);
      viewerRef.current.viewport.panTo(
        viewerRef.current.viewport.imageToViewportCoordinates({
          x: imageWidth / 2,
          y: imageHeight / 2,
        }),
        false,
      );
    } else {
      viewerRef.current.viewport.goHome(false);
    }
    setOverlayTick((value) => value + 1);
  }, [fitRequestKey, fitRequestMode, imageWidth, imageHeight]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport || !page?.viewState) {
      return;
    }
    const currentZoom = getImageZoomFromViewer(viewer);
    const currentOrigin = viewer.viewport.imageToViewerElementCoordinates({ x: 0, y: 0 });
    const zoomDiff = Math.abs(currentZoom - currentView.zoom);
    const panDiff = Math.abs(currentOrigin.x - currentView.panX) + Math.abs(currentOrigin.y - currentView.panY);
    if (zoomDiff < 0.001 && panDiff < 2) {
      return;
    }
    applyViewStateToViewer(viewer, currentView, containerRef.current);
    setOverlayTick((value) => value + 1);
  }, [currentView.zoom, currentView.panX, currentView.panY, page?.viewState]);

  function toScreenPoint(point) {
    const viewer = viewerRef.current;
    if (!viewer?.viewport || !OpenSeadragonLib) {
      return fallbackImageToScreenPoint(point, currentView);
    }
    const screenPoint = viewer.viewport.imageToViewerElementCoordinates(
      new OpenSeadragonLib.Point(point.x, point.y),
    );
    return { x: screenPoint.x, y: screenPoint.y };
  }

  if (!page?.imageDataUrl) {
    return (
      <div ref={containerRef} style={styles.empty}>
        No plans loaded
      </div>
    );
  }

  const showingScaleDraft = activeTool === "scale";
  const scalePointA = showingScaleDraft ? scaleDraft?.pointA : page?.scale?.pointA || page?.scale?.start || null;
  const scalePointB = showingScaleDraft ? scaleDraft?.pointB : page?.scale?.pointB || page?.scale?.end || null;
  const scalePointAScreen = scalePointA ? toScreenPoint(scalePointA) : null;
  const scalePointBScreen = scalePointB ? toScreenPoint(scalePointB) : null;
  const draftMeasurePointA = measureDraft?.pointA || null;
  const draftMeasurePointB = measureDraft?.pointB || null;
  const draftMeasurePointAScreen = draftMeasurePointA ? toScreenPoint(draftMeasurePointA) : null;
  const draftMeasurePointBScreen = draftMeasurePointB ? toScreenPoint(draftMeasurePointB) : null;
  const measurementViews = (page?.measurements || []).map((measurement) => {
    const pointA = measurement.pointA || measurement.points?.[0];
    const pointB = measurement.pointB || measurement.points?.[1];
    const labelPoint = measurement.labelPoint || {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    };

    return {
      ...measurement,
      pointAScreen: toScreenPoint(pointA),
      pointBScreen: toScreenPoint(pointB),
      labelScreen: toScreenPoint(labelPoint),
    };
  });
  const areaViews = (page?.areas || []).map((area) => ({
    ...area,
    screenPoints: (area.points || []).map((point) => toScreenPoint(point)),
    labelScreen: toScreenPoint(area.labelPoint || area.points?.[0] || { x: 0, y: 0 }),
  }));
  const draftAreaPoints = areaDraft?.mode === "rectangle" && areaDraft?.rectanglePointA && areaDraft?.rectanglePointB
    ? [
      { x: areaDraft.rectanglePointA.x, y: areaDraft.rectanglePointA.y },
      { x: areaDraft.rectanglePointB.x, y: areaDraft.rectanglePointA.y },
      { x: areaDraft.rectanglePointB.x, y: areaDraft.rectanglePointB.y },
      { x: areaDraft.rectanglePointA.x, y: areaDraft.rectanglePointB.y },
    ]
    : areaDraft?.mode === "polygon"
      ? areaDraft.polygonPoints || []
      : [];
  const draftAreaScreenPoints = draftAreaPoints.map((point) => toScreenPoint(point));
  const snapMarkerScreen = snapMarker ? toScreenPoint(snapMarker) : null;
  const zoomPercent = Math.round(getImageZoomFromViewer(viewerRef.current) * 100);

  return (
    <div
      style={{
        ...styles.viewport,
        cursor: activeTool === "scale" || activeTool === "measure" || activeTool === "area" ? "crosshair" : styles.viewport.cursor,
      }}
      data-takeoff-engine-canvas
      data-active-tool={activeTool || "select"}
    >
      <div ref={containerRef} style={styles.openSeadragonHost} />
      <div style={styles.overlayLayer} aria-hidden="true">
        {scalePointAScreen && scalePointBScreen ? (
          <svg style={styles.overlay}>
            <line
              x1={scalePointAScreen.x}
              y1={scalePointAScreen.y}
              x2={scalePointBScreen.x}
              y2={scalePointBScreen.y}
              stroke="#2563eb"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        <svg style={styles.overlay}>
          {measurementViews.map((measurement) => (
            <line
              key={measurement.id}
              x1={measurement.pointAScreen.x}
              y1={measurement.pointAScreen.y}
              x2={measurement.pointBScreen.x}
              y2={measurement.pointBScreen.y}
              stroke="#ea580c"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          {draftMeasurePointAScreen && draftMeasurePointBScreen ? (
            <line
              x1={draftMeasurePointAScreen.x}
              y1={draftMeasurePointAScreen.y}
              x2={draftMeasurePointBScreen.x}
              y2={draftMeasurePointBScreen.y}
              stroke="#f97316"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 6"
            />
          ) : null}
        </svg>
        {measurementViews.map((measurement) => (
          <div
            key={`${measurement.id}-label`}
            style={{ ...styles.measurementLabel, left: measurement.labelScreen.x, top: measurement.labelScreen.y }}
          >
            {measurement.displayText}
          </div>
        ))}
        <svg style={styles.overlay}>
          {areaViews.map((area) => (
            <polygon
              key={area.id}
              points={area.screenPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="rgba(124, 58, 237, 0.18)"
              stroke="#7c3aed"
              strokeWidth="3"
            />
          ))}
          {draftAreaScreenPoints.length >= 2 ? (
            <polyline
              points={draftAreaScreenPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              fill={draftAreaScreenPoints.length >= 3 ? "rgba(124, 58, 237, 0.12)" : "none"}
              stroke="#8b5cf6"
              strokeWidth="3"
              strokeDasharray="8 6"
            />
          ) : null}
        </svg>
        {areaViews.map((area) => (
          <div
            key={`${area.id}-area-label`}
            style={{ ...styles.areaLabel, left: area.labelScreen.x, top: area.labelScreen.y }}
          >
            {area.displayText}
          </div>
        ))}
        {draftAreaScreenPoints.map((point, index) => (
          <div key={`draft-area-${index}`} style={{ ...styles.areaHandle, left: point.x, top: point.y }} />
        ))}
        {scalePointAScreen ? <div style={{ ...styles.handle, left: scalePointAScreen.x, top: scalePointAScreen.y }} /> : null}
        {scalePointBScreen ? <div style={{ ...styles.handle, left: scalePointBScreen.x, top: scalePointBScreen.y }} /> : null}
        {draftMeasurePointAScreen ? <div style={{ ...styles.measureHandle, left: draftMeasurePointAScreen.x, top: draftMeasurePointAScreen.y }} /> : null}
        {draftMeasurePointBScreen ? <div style={{ ...styles.measureHandle, left: draftMeasurePointBScreen.x, top: draftMeasurePointBScreen.y }} /> : null}
        {snapMarkerScreen ? (
          <div
            style={{ ...styles.snapMarker, left: snapMarkerScreen.x, top: snapMarkerScreen.y }}
            title={snapMarker.type}
          />
        ) : null}
      </div>
      {tileProgress ? (
        <div style={styles.tileProgress}>
          <strong>Generating tiles...</strong>
          <span>{tileProgress.generatedTiles || 0} / {tileProgress.totalTiles || 0}</span>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${tileProgress.percent || 0}%` }} />
          </div>
        </div>
      ) : null}
      {tileError ? <div style={styles.error}>{tileError}</div> : null}
      <div style={styles.readout}>
        Zoom {zoomPercent}% | Image {Math.round(imageWidth)} x {Math.round(imageHeight)} px | Tiles {tilePyramid?.levelSummaries?.length || 0} levels
      </div>
    </div>
  );
}

export const imageToScreenPoint = fallbackImageToScreenPoint;
export const screenToImagePoint = fallbackScreenToImagePoint;

const styles = {
  viewport: {
    position: "relative",
    flex: "1 1 auto",
    alignSelf: "stretch",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
    background: "#e5e7eb",
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
  },
  openSeadragonHost: {
    position: "absolute",
    inset: 0,
  },
  overlayLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  handle: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 999,
    border: "2px solid #ffffff",
    background: "#2563eb",
    boxShadow: "0 1px 6px rgba(15,23,42,0.35)",
    pointerEvents: "none",
  },
  measureHandle: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 999,
    border: "2px solid #ffffff",
    background: "#ea580c",
    boxShadow: "0 1px 6px rgba(15,23,42,0.35)",
    pointerEvents: "none",
  },
  snapMarker: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 999,
    border: "2px solid #0f172a",
    background: "rgba(34, 197, 94, 0.92)",
    boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.25)",
    pointerEvents: "none",
  },
  measurementLabel: {
    position: "absolute",
    transform: "translate(-50%, -120%)",
    background: "rgba(124, 45, 18, 0.92)",
    color: "#ffffff",
    borderRadius: 6,
    padding: "4px 7px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    boxShadow: "0 1px 6px rgba(15,23,42,0.25)",
  },
  areaHandle: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 999,
    border: "2px solid #ffffff",
    background: "#7c3aed",
    boxShadow: "0 1px 6px rgba(15,23,42,0.35)",
    pointerEvents: "none",
  },
  areaLabel: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    background: "rgba(76, 29, 149, 0.92)",
    color: "#ffffff",
    borderRadius: 6,
    padding: "4px 7px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    boxShadow: "0 1px 6px rgba(15,23,42,0.25)",
  },
  readout: {
    position: "absolute",
    left: 10,
    bottom: 10,
    background: "rgba(15, 23, 42, 0.86)",
    color: "#ffffff",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  tileProgress: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 320,
    maxWidth: "calc(100% - 32px)",
    background: "rgba(15, 23, 42, 0.94)",
    color: "#ffffff",
    borderRadius: 8,
    padding: 14,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
    display: "grid",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
  },
  progressTrack: {
    height: 8,
    background: "#334155",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: "#22c55e",
  },
  error: {
    position: "absolute",
    left: 10,
    top: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 auto",
    minHeight: 420,
    color: "#475569",
    background: "#f1f5f9",
    border: "1px dashed #cbd5e1",
    fontWeight: 700,
  },
};
