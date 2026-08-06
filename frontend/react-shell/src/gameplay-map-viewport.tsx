import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

import type {
  GameSnapshot,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

import { t } from "@frontend-i18n";

import { WarTableIcon } from "@react-shell/war-table-icons";

const MAP_VIEWPORT_DEFAULT_SCALE = 1;
const MAP_VIEWPORT_MAX_SCALE = 3;
const MAP_VIEWPORT_WHEEL_FACTOR = 1.18;
const MAP_VIEWPORT_BUTTON_STEP = 0.2;
const MAP_VIEWPORT_DRAG_THRESHOLD = 8;
const MAP_TERRITORY_NODE_SCALE_EXPONENT = 0;
const MAP_TERRITORY_NODE_MIN_SCALE = 1;

const classicMapLayout = {
  aurora: { x: 17.1, y: 18 },
  bastion: { x: 40.8, y: 14 },
  cinder: { x: 27.6, y: 39 },
  delta: { x: 14.5, y: 63 },
  ember: { x: 50.7, y: 43 },
  forge: { x: 70.4, y: 25 },
  grove: { x: 34.2, y: 84 },
  harbor: { x: 61.8, y: 67 },
  ion: { x: 86.2, y: 50 }
} as const;

type ViewportState = {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
};

type DragState = {
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startTranslateX: number;
  startTranslateY: number;
  suppressClick: boolean;
  didDrag: boolean;
};

type BoardFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FittedBoardSizeInput = {
  allowsHorizontalCrop: boolean;
  aspectRatio: number;
  availableHeight: number;
  availableWidth: number;
  stagePaddingY: number;
};

type MinimumViewportScaleInput = {
  boardHeight: number;
  boardWidth: number;
  surfaceHeight: number;
  surfaceWidth: number;
};

type ClampViewportTranslationInput = MinimumViewportScaleInput & {
  anchorX: number;
  anchorY: number;
  scale: number;
  translateX: number;
  translateY: number;
  viewportBottom?: number;
  viewportLeft?: number;
  viewportRight?: number;
  viewportTop?: number;
};

type ViewportGeometry = {
  anchorX: number;
  anchorY: number;
  viewportBottom: number;
  viewportLeft: number;
  viewportRight: number;
  viewportTop: number;
};

type PointerPosition = {
  clientX: number;
  clientY: number;
};

type PinchState = {
  pointerIds: [number, number];
  startClientX: number;
  startClientY: number;
  startDistance: number;
  startScale: number;
  startTranslateX: number;
  startTranslateY: number;
};

type ZoomOrigin = {
  clientX: number;
  clientY: number;
  scale: number;
  translateX: number;
  translateY: number;
};

type GameplayMapViewportProps = {
  attackFromId: string;
  attackToId: string;
  commandDockSheetState: "collapsed" | "half-open" | "expanded";
  fortifyFromId: string;
  fortifyToId: string;
  myPlayerId: string | null;
  pieceSkinClass: string;
  playersById: Record<string, SnapshotPlayer>;
  reinforceTerritoryId: string;
  snapshot: GameSnapshot;
  onTerritorySelect(territoryId: string): void;
};

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function calculateMinimumViewportScale({
  boardHeight,
  boardWidth,
  surfaceHeight,
  surfaceWidth
}: MinimumViewportScaleInput): number {
  if (surfaceWidth <= 0 || surfaceHeight <= 0 || boardWidth <= 0 || boardHeight <= 0) {
    return MAP_VIEWPORT_DEFAULT_SCALE;
  }

  return Math.min(
    MAP_VIEWPORT_DEFAULT_SCALE,
    surfaceWidth / boardWidth,
    surfaceHeight / boardHeight
  );
}

export function clampViewportTranslation({
  anchorX,
  anchorY,
  boardHeight,
  boardWidth,
  scale,
  surfaceHeight,
  surfaceWidth,
  translateX,
  translateY,
  viewportBottom = surfaceHeight,
  viewportLeft = 0,
  viewportRight = surfaceWidth,
  viewportTop = 0
}: ClampViewportTranslationInput): { x: number; y: number } {
  if (surfaceWidth <= 0 || surfaceHeight <= 0 || boardWidth <= 0 || boardHeight <= 0) {
    return { x: translateX, y: translateY };
  }

  const horizontalBounds = [
    viewportRight - anchorX - (boardWidth * scale) / 2,
    viewportLeft + (boardWidth * scale) / 2 - anchorX
  ];
  const verticalBounds = [
    viewportBottom - anchorY - (boardHeight * scale) / 2,
    viewportTop + (boardHeight * scale) / 2 - anchorY
  ];

  return {
    x: clampNumber(translateX, Math.min(...horizontalBounds), Math.max(...horizontalBounds)),
    y: clampNumber(translateY, Math.min(...verticalBounds), Math.max(...verticalBounds))
  };
}

function normalizeViewport(
  viewport: ViewportState,
  surfaceWidth: number,
  surfaceHeight: number,
  boardWidth: number,
  boardHeight: number,
  geometry?: ViewportGeometry
): ViewportState {
  const resolvedGeometry = geometry || {
    anchorX: surfaceWidth / 2,
    anchorY: surfaceHeight / 2,
    viewportBottom: surfaceHeight,
    viewportLeft: 0,
    viewportRight: surfaceWidth,
    viewportTop: 0
  };
  const minimumScale = calculateMinimumViewportScale({
    boardHeight,
    boardWidth,
    surfaceHeight: resolvedGeometry.viewportBottom - resolvedGeometry.viewportTop,
    surfaceWidth: resolvedGeometry.viewportRight - resolvedGeometry.viewportLeft
  });
  const scale = clampNumber(viewport.scale, minimumScale, MAP_VIEWPORT_MAX_SCALE);
  const clampedTranslation = clampViewportTranslation({
    anchorX: resolvedGeometry.anchorX,
    anchorY: resolvedGeometry.anchorY,
    boardHeight,
    boardWidth,
    scale,
    surfaceHeight,
    surfaceWidth,
    translateX: viewport.translateX,
    translateY: viewport.translateY,
    viewportBottom: resolvedGeometry.viewportBottom,
    viewportLeft: resolvedGeometry.viewportLeft,
    viewportRight: resolvedGeometry.viewportRight,
    viewportTop: resolvedGeometry.viewportTop
  });

  return {
    scale,
    translateX: clampedTranslation.x,
    translateY: clampedTranslation.y,
    isDragging: viewport.isDragging
  };
}

function mapAspectRatio(snapshot: GameSnapshot): string {
  const width = Number(snapshot.mapVisual?.aspectRatio?.width || 0);
  const height = Number(snapshot.mapVisual?.aspectRatio?.height || 0);
  if (width > 0 && height > 0) {
    return `${width} / ${height}`;
  }

  return "760 / 500";
}

function resolveMapImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("//")) {
    return imageUrl;
  }

  if (/^(?:[a-z][a-z0-9+.-]*:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  return imageUrl;
}

function readCssLengthPixelValue(
  element: HTMLElement,
  styles: CSSStyleDeclaration,
  propertyName: string
): number {
  const rawValue = styles.getPropertyValue(propertyName).trim();
  if (!rawValue) {
    return 0;
  }

  if (rawValue === "0") {
    return 0;
  }

  const pixelMatch = rawValue.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (pixelMatch) {
    const value = Number.parseFloat(pixelMatch[1]);
    return Number.isFinite(value) ? value : 0;
  }

  const measurement = document.createElement("div");
  measurement.style.position = "absolute";
  measurement.style.visibility = "hidden";
  measurement.style.pointerEvents = "none";
  measurement.style.boxSizing = "border-box";
  measurement.style.width = rawValue;
  measurement.style.height = "0";
  measurement.style.margin = "0";
  measurement.style.padding = "0";
  measurement.style.border = "0";

  element.appendChild(measurement);
  const measuredWidth = measurement.getBoundingClientRect().width;
  measurement.remove();

  if (Number.isFinite(measuredWidth) && measuredWidth >= 0) {
    return measuredWidth;
  }

  const fallback = Number.parseFloat(rawValue);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function calculateFittedBoardSize({
  allowsHorizontalCrop,
  aspectRatio,
  availableHeight,
  availableWidth,
  stagePaddingY
}: FittedBoardSizeInput): { width: number; height: number } {
  const widthFromHeight = Math.max(0, (availableHeight - stagePaddingY) * aspectRatio);
  const fittedWidth = Math.min(availableWidth, widthFromHeight);
  const width = allowsHorizontalCrop
    ? widthFromHeight >= availableWidth
      ? Math.min(widthFromHeight, availableWidth * 1.9)
      : fittedWidth
    : fittedWidth;

  return {
    width: Math.floor(width),
    height: Math.ceil(width / aspectRatio)
  };
}

function territoryOwnerName(
  territory: SnapshotTerritory,
  playersById: Record<string, SnapshotPlayer>
): string {
  if (!territory.ownerId) {
    return t("game.runtime.none");
  }

  return playersById[territory.ownerId]?.name || territory.ownerId;
}

function territoryPosition(territory: SnapshotTerritory): { x: number; y: number } | null {
  if (Number.isFinite(territory.x) && Number.isFinite(territory.y)) {
    return {
      x: Number(territory.x) * 100,
      y: Number(territory.y) * 100
    };
  }

  return classicMapLayout[territory.id as keyof typeof classicMapLayout] || null;
}

export function GameplayMapViewport({
  attackFromId,
  attackToId,
  commandDockSheetState,
  fortifyFromId,
  fortifyToId,
  myPlayerId,
  pieceSkinClass,
  playersById,
  reinforceTerritoryId,
  snapshot,
  onTerritorySelect
}: GameplayMapViewportProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceElement, setSurfaceElement] = useState<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportState>({
    scale: MAP_VIEWPORT_DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
    isDragging: false
  });
  const dragStateRef = useRef<DragState>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    suppressClick: false,
    didDrag: false
  });
  const activePointersRef = useRef<Map<number, PointerPosition>>(new Map());
  const pinchStateRef = useRef<PinchState | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [fittedBoardFrame, setFittedBoardFrame] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [renderedBoardFrame, setRenderedBoardFrame] = useState<BoardFrame | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: MAP_VIEWPORT_DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
    isDragging: false
  });

  function currentSurfaceSize(): { width: number; height: number } {
    const surface = surfaceElement || surfaceRef.current;
    return {
      width: surface?.clientWidth || surfaceSize.width,
      height: surface?.clientHeight || surfaceSize.height
    };
  }

  function currentBoardSize(): { width: number; height: number } {
    const board = boardRef.current;
    if (board) {
      return {
        width: board.offsetWidth,
        height: board.offsetHeight
      };
    }

    return {
      width: fittedBoardFrame?.width || 0,
      height: fittedBoardFrame?.height || 0
    };
  }

  function currentViewportGeometry(
    currentSurfaceWidth: number,
    currentSurfaceHeight: number
  ): ViewportGeometry {
    const surface = surfaceRef.current;
    let safeTop = 0;
    let safeBottom = 0;
    if (surface) {
      const surfaceStyles = window.getComputedStyle(surface);
      safeTop = readCssLengthPixelValue(surface, surfaceStyles, "--game-map-safe-top");
      safeBottom = readCssLengthPixelValue(surface, surfaceStyles, "--game-map-safe-bottom");
    }
    const viewportTop = clampNumber(safeTop, 0, currentSurfaceHeight);
    const viewportBottom = clampNumber(
      currentSurfaceHeight - safeBottom,
      viewportTop,
      currentSurfaceHeight
    );
    const anchor = anchorRef.current;

    return {
      anchorX: anchor?.offsetLeft ?? currentSurfaceWidth / 2,
      anchorY: anchor?.offsetTop ?? (viewportTop + viewportBottom) / 2,
      viewportBottom,
      viewportLeft: 0,
      viewportRight: currentSurfaceWidth,
      viewportTop
    };
  }

  function measureRenderedBoardFrame(): void {
    const surface = surfaceRef.current;
    const board = boardRef.current;
    if (!surface || !board) {
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const nextFrame = {
      left: boardRect.left - surfaceRect.left,
      top: boardRect.top - surfaceRect.top,
      width: boardRect.width,
      height: boardRect.height
    };

    setRenderedBoardFrame((currentFrame) => {
      if (
        currentFrame &&
        Math.abs(currentFrame.left - nextFrame.left) < 0.5 &&
        Math.abs(currentFrame.top - nextFrame.top) < 0.5 &&
        Math.abs(currentFrame.width - nextFrame.width) < 0.5 &&
        Math.abs(currentFrame.height - nextFrame.height) < 0.5
      ) {
        return currentFrame;
      }

      return nextFrame;
    });
  }

  const handleSurfaceRef = useCallback((node: HTMLDivElement | null): void => {
    if (surfaceRef.current === node) {
      return;
    }

    surfaceRef.current = node;
    setSurfaceElement(node);
  }, []);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const surface = surfaceElement;
    if (!surface) {
      return;
    }

    const activeSurface = surface;

    function measureSurface(): void {
      setSurfaceSize({
        width: activeSurface.clientWidth,
        height: activeSurface.clientHeight
      });
    }

    measureSurface();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureSurface);
      return () => {
        window.removeEventListener("resize", measureSurface);
      };
    }

    const observer = new ResizeObserver(() => {
      measureSurface();
    });
    observer.observe(activeSurface);

    return () => {
      observer.disconnect();
    };
  }, [surfaceElement]);

  useEffect(() => {
    const surface = surfaceElement;
    if (!surface) {
      return;
    }

    function handleNativeWheel(event: globalThis.WheelEvent): void {
      event.preventDefault();
      zoomTo(
        viewportRef.current.scale *
          (event.deltaY < 0 ? MAP_VIEWPORT_WHEEL_FACTOR : 1 / MAP_VIEWPORT_WHEEL_FACTOR),
        event.clientX,
        event.clientY
      );
    }

    surface.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      surface.removeEventListener("wheel", handleNativeWheel);
    };
  }, [surfaceElement, surfaceSize.height, surfaceSize.width]);

  useEffect(() => {
    function handleWindowPointerMove(event: globalThis.PointerEvent): void {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, {
          clientX: event.clientX,
          clientY: event.clientY
        });
      }

      const pinchState = pinchStateRef.current;
      if (pinchState) {
        const firstPointer = activePointersRef.current.get(pinchState.pointerIds[0]);
        const secondPointer = activePointersRef.current.get(pinchState.pointerIds[1]);
        if (!firstPointer || !secondPointer) {
          return;
        }

        const distance = Math.hypot(
          secondPointer.clientX - firstPointer.clientX,
          secondPointer.clientY - firstPointer.clientY
        );
        if (distance <= 0 || pinchState.startDistance <= 0) {
          return;
        }

        dragStateRef.current.didDrag = true;
        dragStateRef.current.suppressClick = true;
        zoomTo(
          pinchState.startScale * (distance / pinchState.startDistance),
          (firstPointer.clientX + secondPointer.clientX) / 2,
          (firstPointer.clientY + secondPointer.clientY) / 2,
          true,
          {
            clientX: pinchState.startClientX,
            clientY: pinchState.startClientY,
            scale: pinchState.startScale,
            translateX: pinchState.startTranslateX,
            translateY: pinchState.startTranslateY
          }
        );
        return;
      }

      if (dragStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startClientX;
      const deltaY = event.clientY - dragStateRef.current.startClientY;
      if (
        !dragStateRef.current.didDrag &&
        Math.hypot(deltaX, deltaY) < MAP_VIEWPORT_DRAG_THRESHOLD
      ) {
        return;
      }

      dragStateRef.current.didDrag = true;
      dragStateRef.current.suppressClick = true;
      const nextSurfaceSize = currentSurfaceSize();
      const nextBoardSize = currentBoardSize();
      const nextViewportGeometry = currentViewportGeometry(
        nextSurfaceSize.width,
        nextSurfaceSize.height
      );
      setViewport((currentViewport) => {
        const nextViewport = normalizeViewport(
          {
            ...currentViewport,
            translateX: dragStateRef.current.startTranslateX + deltaX,
            translateY: dragStateRef.current.startTranslateY + deltaY,
            isDragging: true
          },
          nextSurfaceSize.width,
          nextSurfaceSize.height,
          nextBoardSize.width,
          nextBoardSize.height,
          nextViewportGeometry
        );
        viewportRef.current = nextViewport;
        return nextViewport;
      });
    }

    function handleWindowPointerFinish(event: globalThis.PointerEvent): void {
      finishPointer(event.pointerId);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerFinish);
    window.addEventListener("pointercancel", handleWindowPointerFinish);

    return () => {
      activePointersRef.current.clear();
      pinchStateRef.current = null;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerFinish);
      window.removeEventListener("pointercancel", handleWindowPointerFinish);
    };
  }, []);

  useEffect(() => {
    setViewport((currentViewport) => {
      const nextViewportGeometry = currentViewportGeometry(surfaceSize.width, surfaceSize.height);
      return normalizeViewport(
        currentViewport,
        surfaceSize.width,
        surfaceSize.height,
        currentBoardSize().width,
        currentBoardSize().height,
        nextViewportGeometry
      );
    });
  }, [
    commandDockSheetState,
    fittedBoardFrame?.height,
    fittedBoardFrame?.width,
    surfaceSize.height,
    surfaceSize.width
  ]);

  useLayoutEffect(() => {
    measureRenderedBoardFrame();
  }, [
    fittedBoardFrame?.height,
    fittedBoardFrame?.width,
    surfaceSize.height,
    surfaceSize.width,
    viewport.scale,
    viewport.translateX,
    viewport.translateY
  ]);

  useEffect(() => {
    const mapContainer = mapRef.current;
    const mapBoard = boardRef.current;
    if (!mapContainer || !mapBoard) {
      return;
    }

    const mapStageElement = mapContainer.closest(".game-map-stage");
    if (!(mapStageElement instanceof HTMLElement)) {
      return;
    }
    const mapStage = mapStageElement;
    const resolvedBoard = mapBoard;

    function fitBoardToViewport(): void {
      const stageStyles = window.getComputedStyle(mapStage);
      const stagePaddingX =
        Number.parseFloat(stageStyles.paddingLeft || "0") +
        Number.parseFloat(stageStyles.paddingRight || "0");
      const stagePaddingY =
        Number.parseFloat(stageStyles.paddingTop || "0") +
        Number.parseFloat(stageStyles.paddingBottom || "0");
      const safeTop = readCssLengthPixelValue(mapStage, stageStyles, "--game-map-safe-top");
      const safeBottom = readCssLengthPixelValue(mapStage, stageStyles, "--game-map-safe-bottom");
      const availableWidth = Math.max(0, mapStage.clientWidth - stagePaddingX);
      const stageRect = mapStage.getBoundingClientRect();
      const availableHeight = Math.max(
        0,
        window.innerHeight -
          stageRect.top -
          Number.parseFloat(stageStyles.paddingBottom || "0") -
          safeTop -
          safeBottom
      );
      if (!availableWidth || !availableHeight) {
        return;
      }

      const aspectRatioValue =
        resolvedBoard.style.aspectRatio ||
        window.getComputedStyle(resolvedBoard).aspectRatio ||
        "760 / 500";
      const aspectRatioMatch = aspectRatioValue.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      const aspectRatio = aspectRatioMatch
        ? Number.parseFloat(aspectRatioMatch[1]) / Number.parseFloat(aspectRatioMatch[2])
        : 760 / 500;
      const allowsHorizontalCrop =
        stageStyles.getPropertyValue("--game-map-allow-horizontal-crop").trim() === "1";
      setFittedBoardFrame({
        ...calculateFittedBoardSize({
          allowsHorizontalCrop,
          aspectRatio,
          availableHeight,
          availableWidth,
          stagePaddingY
        })
      });
    }

    fitBoardToViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fitBoardToViewport);
      return () => {
        window.removeEventListener("resize", fitBoardToViewport);
      };
    }

    const observer = new ResizeObserver(() => {
      fitBoardToViewport();
    });
    observer.observe(mapStage);
    window.addEventListener("resize", fitBoardToViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitBoardToViewport);
    };
  }, [
    commandDockSheetState,
    snapshot.cardState?.currentPlayerMustTrade,
    snapshot.mapVisual?.aspectRatio?.height,
    snapshot.mapVisual?.aspectRatio?.width,
    snapshot.pendingConquest?.toId,
    snapshot.phase,
    snapshot.turnPhase
  ]);

  useEffect(() => {
    activePointersRef.current.clear();
    pinchStateRef.current = null;
    dragStateRef.current = {
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startTranslateX: 0,
      startTranslateY: 0,
      suppressClick: false,
      didDrag: false
    };
    setViewport({
      scale: MAP_VIEWPORT_DEFAULT_SCALE,
      translateX: 0,
      translateY: 0,
      isDragging: false
    });
  }, [
    snapshot.gameId,
    snapshot.map.length,
    snapshot.mapVisual?.imageUrl,
    snapshot.mapVisual?.aspectRatio?.height,
    snapshot.mapVisual?.aspectRatio?.width
  ]);

  function zoomTo(
    nextScale: number,
    clientX: number,
    clientY: number,
    isGestureActive = false,
    origin?: ZoomOrigin
  ): void {
    const surface = surfaceRef.current;
    const nextSurfaceSize = currentSurfaceSize();
    const nextBoardSize = currentBoardSize();
    if (!surface || nextSurfaceSize.width <= 0 || nextSurfaceSize.height <= 0) {
      return;
    }
    const nextViewportGeometry = currentViewportGeometry(
      nextSurfaceSize.width,
      nextSurfaceSize.height
    );

    setViewport((currentViewport) => {
      const sourceViewport = origin
        ? {
            scale: origin.scale,
            translateX: origin.translateX,
            translateY: origin.translateY,
            isDragging: true
          }
        : currentViewport;
      const normalizedViewport = normalizeViewport(
        sourceViewport,
        nextSurfaceSize.width,
        nextSurfaceSize.height,
        nextBoardSize.width,
        nextBoardSize.height,
        nextViewportGeometry
      );
      const minimumScale = calculateMinimumViewportScale({
        boardHeight: nextBoardSize.height,
        boardWidth: nextBoardSize.width,
        surfaceHeight: nextViewportGeometry.viewportBottom - nextViewportGeometry.viewportTop,
        surfaceWidth: nextViewportGeometry.viewportRight - nextViewportGeometry.viewportLeft
      });
      const clampedScale = clampNumber(nextScale, minimumScale, MAP_VIEWPORT_MAX_SCALE);
      if (clampedScale <= minimumScale + 0.001 && nextScale <= normalizedViewport.scale) {
        const nextViewport = normalizeViewport(
          {
            ...normalizedViewport,
            scale: minimumScale,
            translateX: 0,
            translateY: 0,
            isDragging: isGestureActive
          },
          nextSurfaceSize.width,
          nextSurfaceSize.height,
          nextBoardSize.width,
          nextBoardSize.height,
          nextViewportGeometry
        );
        viewportRef.current = nextViewport;
        return nextViewport;
      }

      if (!origin && Math.abs(clampedScale - normalizedViewport.scale) < 0.001) {
        const nextViewport = {
          ...normalizedViewport,
          isDragging: isGestureActive
        };
        viewportRef.current = nextViewport;
        return nextViewport;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const localX = clientX - surfaceRect.left;
      const localY = clientY - surfaceRect.top;
      const originLocalX = (origin?.clientX ?? clientX) - surfaceRect.left;
      const originLocalY = (origin?.clientY ?? clientY) - surfaceRect.top;
      const currentCenterX = nextViewportGeometry.anchorX + normalizedViewport.translateX;
      const currentCenterY = nextViewportGeometry.anchorY + normalizedViewport.translateY;
      const contentX = (originLocalX - currentCenterX) / normalizedViewport.scale;
      const contentY = (originLocalY - currentCenterY) / normalizedViewport.scale;
      const nextTranslateX = localX - nextViewportGeometry.anchorX - contentX * clampedScale;
      const nextTranslateY = localY - nextViewportGeometry.anchorY - contentY * clampedScale;
      const nextViewport = normalizeViewport(
        {
          scale: clampedScale,
          translateX: nextTranslateX,
          translateY: nextTranslateY,
          isDragging: isGestureActive
        },
        nextSurfaceSize.width,
        nextSurfaceSize.height,
        nextBoardSize.width,
        nextBoardSize.height,
        nextViewportGeometry
      );
      viewportRef.current = nextViewport;
      return nextViewport;
    });
  }

  function zoomByStep(direction: 1 | -1): void {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const nextSurfaceSize = currentSurfaceSize();
    const nextBoardSize = currentBoardSize();
    const nextViewportGeometry = currentViewportGeometry(
      nextSurfaceSize.width,
      nextSurfaceSize.height
    );
    const minimumScale = calculateMinimumViewportScale({
      boardHeight: nextBoardSize.height,
      boardWidth: nextBoardSize.width,
      surfaceHeight: nextViewportGeometry.viewportBottom - nextViewportGeometry.viewportTop,
      surfaceWidth: nextViewportGeometry.viewportRight - nextViewportGeometry.viewportLeft
    });

    if (
      direction === -1 &&
      viewport.scale <= minimumScale + 0.001 &&
      Math.hypot(viewport.translateX, viewport.translateY) > 1
    ) {
      setViewport((currentViewport) => {
        const nextViewport = normalizeViewport(
          {
            ...currentViewport,
            scale: minimumScale,
            translateX: 0,
            translateY: 0,
            isDragging: false
          },
          nextSurfaceSize.width,
          nextSurfaceSize.height,
          nextBoardSize.width,
          nextBoardSize.height,
          nextViewportGeometry
        );
        viewportRef.current = nextViewport;
        return nextViewport;
      });
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    zoomTo(
      viewport.scale + direction * MAP_VIEWPORT_BUTTON_STEP,
      surfaceRect.left + surfaceRect.width / 2,
      surfaceRect.top + surfaceRect.height / 2
    );
  }

  function startPinchGesture(): boolean {
    const pointers = Array.from(activePointersRef.current.entries()).slice(0, 2);
    if (pointers.length < 2) {
      return false;
    }

    const [[firstPointerId, firstPointer], [secondPointerId, secondPointer]] = pointers;
    const startDistance = Math.hypot(
      secondPointer.clientX - firstPointer.clientX,
      secondPointer.clientY - firstPointer.clientY
    );
    if (startDistance <= 0) {
      return false;
    }

    pinchStateRef.current = {
      pointerIds: [firstPointerId, secondPointerId],
      startClientX: (firstPointer.clientX + secondPointer.clientX) / 2,
      startClientY: (firstPointer.clientY + secondPointer.clientY) / 2,
      startDistance,
      startScale: viewportRef.current.scale,
      startTranslateX: viewportRef.current.translateX,
      startTranslateY: viewportRef.current.translateY
    };
    dragStateRef.current.pointerId = null;
    dragStateRef.current.didDrag = true;
    dragStateRef.current.suppressClick = true;
    setViewport((currentViewport) => {
      const nextViewport = {
        ...currentViewport,
        isDragging: true
      };
      viewportRef.current = nextViewport;
      return nextViewport;
    });
    return true;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType !== "touch" && event.button !== 0) {
      return;
    }

    viewportRef.current = viewport;
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
    if (activePointersRef.current.size >= 2 && startPinchGesture()) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTranslateX: viewport.translateX,
      startTranslateY: viewport.translateY,
      suppressClick: false,
      didDrag: false
    };
  }

  function finishPointer(pointerId: number): void {
    activePointersRef.current.delete(pointerId);

    if (pinchStateRef.current) {
      pinchStateRef.current = null;
      dragStateRef.current.suppressClick = true;
      dragStateRef.current.didDrag = true;

      if (activePointersRef.current.size >= 2 && startPinchGesture()) {
        return;
      }

      const remainingPointer = activePointersRef.current.entries().next().value as
        | [number, PointerPosition]
        | undefined;
      const currentViewport = viewportRef.current;
      dragStateRef.current = remainingPointer
        ? {
            pointerId: remainingPointer[0],
            startClientX: remainingPointer[1].clientX,
            startClientY: remainingPointer[1].clientY,
            startTranslateX: currentViewport.translateX,
            startTranslateY: currentViewport.translateY,
            suppressClick: true,
            didDrag: true
          }
        : {
            pointerId: null,
            startClientX: 0,
            startClientY: 0,
            startTranslateX: currentViewport.translateX,
            startTranslateY: currentViewport.translateY,
            suppressClick: true,
            didDrag: true
          };
      setViewport((currentState) => {
        const nextViewport = {
          ...currentState,
          isDragging: false
        };
        viewportRef.current = nextViewport;
        return nextViewport;
      });
      return;
    }

    if (dragStateRef.current.pointerId !== pointerId) {
      return;
    }

    dragStateRef.current.pointerId = null;
    setViewport((currentViewport) => {
      const nextViewport = currentViewport.isDragging
        ? {
            ...currentViewport,
            isDragging: false
          }
        : currentViewport;
      viewportRef.current = nextViewport;
      return nextViewport;
    });
  }

  function handleTerritoryClick(territoryId: string): void {
    if (dragStateRef.current.suppressClick) {
      dragStateRef.current.suppressClick = false;
      return;
    }

    onTerritorySelect(territoryId);
  }

  const viewportSize = currentSurfaceSize();
  const boardSize = currentBoardSize();
  const viewportGeometry = currentViewportGeometry(viewportSize.width, viewportSize.height);
  const minimumScale = calculateMinimumViewportScale({
    boardHeight: boardSize.height,
    boardWidth: boardSize.width,
    surfaceHeight: viewportGeometry.viewportBottom - viewportGeometry.viewportTop,
    surfaceWidth: viewportGeometry.viewportRight - viewportGeometry.viewportLeft
  });
  const fittedTranslation = clampViewportTranslation({
    anchorX: viewportGeometry.anchorX,
    anchorY: viewportGeometry.anchorY,
    boardHeight: boardSize.height,
    boardWidth: boardSize.width,
    scale: minimumScale,
    surfaceHeight: viewportSize.height,
    surfaceWidth: viewportSize.width,
    translateX: 0,
    translateY: 0,
    viewportBottom: viewportGeometry.viewportBottom,
    viewportLeft: viewportGeometry.viewportLeft,
    viewportRight: viewportGeometry.viewportRight,
    viewportTop: viewportGeometry.viewportTop
  });
  const hasViewportOffset =
    Math.hypot(
      viewport.translateX - fittedTranslation.x,
      viewport.translateY - fittedTranslation.y
    ) > 1;
  const connectionBadgeClassName =
    Math.abs(viewport.scale - MAP_VIEWPORT_DEFAULT_SCALE) > 0.001 || hasViewportOffset
      ? viewport.isDragging
        ? "map-board-surface is-zoomed is-dragging"
        : "map-board-surface is-zoomed"
      : "map-board-surface";
  const nodeScale = Math.max(
    MAP_TERRITORY_NODE_MIN_SCALE,
    Math.pow(1 / Math.max(viewport.scale, 1), MAP_TERRITORY_NODE_SCALE_EXPONENT)
  );
  const boardClassNames = ["map-board"];
  if (snapshot.mapId) {
    boardClassNames.push(
      `map-id-${String(snapshot.mapId)
        .replace(/[^a-z0-9_-]/gi, "-")
        .toLowerCase()}`
    );
  }
  if (snapshot.mapVisual?.imageUrl) {
    boardClassNames.push("has-custom-background");
  }
  const boardStyle: CSSProperties = {
    aspectRatio: mapAspectRatio(snapshot),
    ...(fittedBoardFrame
      ? {
          width: `${fittedBoardFrame.width}px`,
          height: `${fittedBoardFrame.height}px`
        }
      : {}),
    ...(snapshot.mapVisual?.imageUrl
      ? {
          "--map-background-image": `url(${resolveMapImageUrl(snapshot.mapVisual.imageUrl)})`
        }
      : {})
  } as CSSProperties;
  const markerBoardFrame =
    renderedBoardFrame ||
    ({
      left: viewportGeometry.anchorX + viewport.translateX - (boardSize.width * viewport.scale) / 2,
      top: viewportGeometry.anchorY + viewport.translateY - (boardSize.height * viewport.scale) / 2,
      width: boardSize.width * viewport.scale,
      height: boardSize.height * viewport.scale
    } satisfies BoardFrame);

  return (
    <div
      ref={mapRef}
      id="map"
      className="map tactical-map"
      data-testid="map-region"
      style={fittedBoardFrame ? { height: `${fittedBoardFrame.height}px` } : undefined}
    >
      <div className="map-viewport" data-map-viewport>
        <div className="map-controls" data-map-controls>
          <button
            type="button"
            className="map-control-button"
            data-map-control="zoom-in"
            aria-label={t("game.map.zoomIn")}
            title={t("game.map.zoomIn")}
            onClick={() => zoomByStep(1)}
            disabled={viewport.scale >= MAP_VIEWPORT_MAX_SCALE - 0.001}
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            className="map-control-button"
            data-map-control="zoom-out"
            aria-label={t("game.map.zoomOut")}
            title={t("game.map.zoomOut")}
            onClick={() => zoomByStep(-1)}
            disabled={viewport.scale <= minimumScale + 0.001 && !hasViewportOffset}
          >
            <span aria-hidden="true">-</span>
          </button>
          <button
            type="button"
            className="map-control-button"
            data-map-control="focus"
            aria-label={t("game.map.fit")}
            title={t("game.map.fit")}
            onClick={() =>
              setViewport(() => {
                const nextSurfaceSize = currentSurfaceSize();
                const nextBoardSize = currentBoardSize();
                const nextViewportGeometry = currentViewportGeometry(
                  nextSurfaceSize.width,
                  nextSurfaceSize.height
                );
                const nextViewport = normalizeViewport(
                  {
                    scale: minimumScale,
                    translateX: 0,
                    translateY: 0,
                    isDragging: false
                  },
                  nextSurfaceSize.width,
                  nextSurfaceSize.height,
                  nextBoardSize.width,
                  nextBoardSize.height,
                  nextViewportGeometry
                );
                viewportRef.current = nextViewport;
                return nextViewport;
              })
            }
          >
            <WarTableIcon name="objective" />
          </button>
        </div>

        <div
          ref={handleSurfaceRef}
          className={connectionBadgeClassName}
          data-map-surface=""
          data-map-scale={viewport.scale.toFixed(3)}
          data-map-min-scale={minimumScale.toFixed(3)}
          data-map-node-scale={nodeScale.toFixed(4)}
          data-map-translate-x={viewport.translateX.toFixed(2)}
          data-map-translate-y={viewport.translateY.toFixed(2)}
          data-map-viewport-bottom={viewportGeometry.viewportBottom.toFixed(2)}
          data-map-viewport-top={viewportGeometry.viewportTop.toFixed(2)}
          style={
            {
              aspectRatio: mapAspectRatio(snapshot),
              ...(fittedBoardFrame ? { height: `${fittedBoardFrame.height}px` } : {}),
              "--map-territory-node-scale": nodeScale.toFixed(4)
            } as CSSProperties
          }
          onPointerDown={handlePointerDown}
        >
          <div
            ref={anchorRef}
            className="map-board-anchor"
            data-map-anchor
            style={{
              transform: `translate(-50%, -50%) translate(${viewport.translateX}px, ${viewport.translateY}px)`
            }}
          >
            <div
              className="map-board-transform"
              data-map-transform
              style={{
                transform: `scale(${viewport.scale})`
              }}
            >
              <div
                ref={boardRef}
                className={`${boardClassNames.join(" ")} ${pieceSkinClass}`}
                style={boardStyle}
              >
                <div className="map-board-stage">
                  <svg className="map-lines" viewBox="0 0 100 100" aria-hidden="true">
                    {(snapshot.map || []).flatMap((territory) => {
                      const sourcePosition = territoryPosition(territory);
                      if (!sourcePosition) {
                        return [];
                      }

                      return territory.neighbors
                        .filter((neighborId) => territory.id < neighborId)
                        .map((neighborId) => {
                          const target = snapshot.map.find((entry) => entry.id === neighborId);
                          const targetPosition = target ? territoryPosition(target) : null;
                          if (!targetPosition) {
                            return null;
                          }

                          return (
                            <line
                              key={`${territory.id}-${neighborId}`}
                              className="map-link"
                              x1={sourcePosition.x}
                              y1={sourcePosition.y}
                              x2={targetPosition.x}
                              y2={targetPosition.y}
                            />
                          );
                        });
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="map-markers-layer" data-map-markers>
            {(snapshot.map || []).map((territory) => {
              const isMine = territory.ownerId === myPlayerId;
              const isAttackSource = territory.id === attackFromId;
              const isAttackTarget = territory.id === attackToId;
              const isReinforceTarget = territory.id === reinforceTerritoryId;
              const isFortifySource = territory.id === fortifyFromId;
              const isFortifyTarget = territory.id === fortifyToId;
              const isSource = isAttackSource || isFortifySource;
              const isTarget = isAttackTarget || isFortifyTarget;
              const position = territoryPosition(territory);
              const markerLeft =
                markerBoardFrame.left + ((position?.x || 50) / 100) * markerBoardFrame.width;
              const markerTop =
                markerBoardFrame.top + ((position?.y || 50) / 100) * markerBoardFrame.height;
              const territoryStyle = {
                left: `${markerLeft}px`,
                top: `${markerTop}px`,
                "--owner-color":
                  territory.ownerId && playersById[territory.ownerId]?.color
                    ? playersById[territory.ownerId].color
                    : "#9aa6b2"
              } as CSSProperties;

              return (
                <button
                  key={territory.id}
                  type="button"
                  className={`territory-node ${pieceSkinClass}${isMine ? " is-mine" : ""}${isSource ? " is-source" : ""}${isTarget ? " is-target" : ""}${isReinforceTarget ? " is-reinforce" : ""}${isFortifySource ? " is-fortify-source" : ""}${isFortifyTarget ? " is-fortify-target" : ""}`}
                  data-territory-id={territory.id}
                  data-map-position-x={String(position?.x || 50)}
                  data-map-position-y={String(position?.y || 50)}
                  style={territoryStyle}
                  title={territory.name}
                  aria-label={`${territory.name}: ${territory.armies} armate`}
                  onClick={() => handleTerritoryClick(territory.id)}
                >
                  <span className="territory-armies">{territory.armies}</span>
                  <span className="visually-hidden">
                    {territoryOwnerName(territory, playersById)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
