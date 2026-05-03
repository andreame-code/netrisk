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

const MAP_VIEWPORT_MIN_SCALE = 1;
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

type GameplayMapViewportProps = {
  attackFromId: string;
  attackToId: string;
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

function clampTranslation(
  translateX: number,
  translateY: number,
  scale: number,
  surfaceWidth: number,
  surfaceHeight: number,
  boardWidth: number,
  boardHeight: number
): { x: number; y: number } {
  if (surfaceWidth <= 0 || surfaceHeight <= 0 || boardWidth <= 0 || boardHeight <= 0) {
    return { x: translateX, y: translateY };
  }

  const overflowX = Math.max(0, (boardWidth * scale) / 2);
  const overflowY = Math.max(0, (boardHeight * scale) / 2);

  return {
    x: clampNumber(translateX, -overflowX, overflowX),
    y: clampNumber(translateY, -overflowY, overflowY)
  };
}

function normalizeViewport(
  viewport: ViewportState,
  surfaceWidth: number,
  surfaceHeight: number,
  boardWidth: number,
  boardHeight: number
): ViewportState {
  const scale = clampNumber(viewport.scale, MAP_VIEWPORT_MIN_SCALE, MAP_VIEWPORT_MAX_SCALE);
  const clampedTranslation = clampTranslation(
    viewport.translateX,
    viewport.translateY,
    scale,
    surfaceWidth,
    surfaceHeight,
    boardWidth,
    boardHeight
  );

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

function readCssPixelValue(styles: CSSStyleDeclaration, propertyName: string): number {
  const value = Number.parseFloat(styles.getPropertyValue(propertyName) || "0");
  return Number.isFinite(value) ? value : 0;
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceElement, setSurfaceElement] = useState<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportState>({
    scale: MAP_VIEWPORT_MIN_SCALE,
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
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [fittedBoardFrame, setFittedBoardFrame] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [renderedBoardFrame, setRenderedBoardFrame] = useState<BoardFrame | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: MAP_VIEWPORT_MIN_SCALE,
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
      setViewport((currentViewport) =>
        normalizeViewport(
          {
            ...currentViewport,
            translateX: dragStateRef.current.startTranslateX + deltaX,
            translateY: dragStateRef.current.startTranslateY + deltaY,
            isDragging: true
          },
          nextSurfaceSize.width,
          nextSurfaceSize.height,
          nextBoardSize.width,
          nextBoardSize.height
        )
      );
    }

    function handleWindowPointerFinish(event: globalThis.PointerEvent): void {
      finishPointer(event.pointerId);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerFinish);
    window.addEventListener("pointercancel", handleWindowPointerFinish);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerFinish);
      window.removeEventListener("pointercancel", handleWindowPointerFinish);
    };
  }, []);

  useEffect(() => {
    setViewport((currentViewport) =>
      normalizeViewport(
        currentViewport,
        surfaceSize.width,
        surfaceSize.height,
        currentBoardSize().width,
        currentBoardSize().height
      )
    );
  }, [fittedBoardFrame?.height, fittedBoardFrame?.width, surfaceSize.height, surfaceSize.width]);

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
      const safeTop = readCssPixelValue(stageStyles, "--game-map-safe-top");
      const safeBottom = readCssPixelValue(stageStyles, "--game-map-safe-bottom");
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
      const widthFromHeight = Math.max(0, (availableHeight - stagePaddingY) * aspectRatio);
      const width = Math.min(availableWidth, widthFromHeight);
      const height = width / aspectRatio;

      setFittedBoardFrame({
        width: Math.floor(width),
        height: Math.ceil(height)
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
    snapshot.cardState?.currentPlayerMustTrade,
    snapshot.mapVisual?.aspectRatio?.height,
    snapshot.mapVisual?.aspectRatio?.width,
    snapshot.pendingConquest?.toId,
    snapshot.phase,
    snapshot.turnPhase
  ]);

  useEffect(() => {
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
      scale: MAP_VIEWPORT_MIN_SCALE,
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

  function zoomTo(nextScale: number, clientX: number, clientY: number): void {
    const surface = surfaceRef.current;
    const nextSurfaceSize = currentSurfaceSize();
    const nextBoardSize = currentBoardSize();
    if (!surface || nextSurfaceSize.width <= 0 || nextSurfaceSize.height <= 0) {
      return;
    }

    setViewport((currentViewport) => {
      const normalizedViewport = normalizeViewport(
        currentViewport,
        nextSurfaceSize.width,
        nextSurfaceSize.height,
        nextBoardSize.width,
        nextBoardSize.height
      );
      const clampedScale = clampNumber(nextScale, MAP_VIEWPORT_MIN_SCALE, MAP_VIEWPORT_MAX_SCALE);
      if (clampedScale <= MAP_VIEWPORT_MIN_SCALE + 0.001 && nextScale <= normalizedViewport.scale) {
        return {
          ...normalizedViewport,
          scale: MAP_VIEWPORT_MIN_SCALE,
          translateX: 0,
          translateY: 0,
          isDragging: false
        };
      }

      if (Math.abs(clampedScale - normalizedViewport.scale) < 0.001) {
        return normalizedViewport;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const localX = clientX - surfaceRect.left;
      const localY = clientY - surfaceRect.top;
      const currentCenterX = nextSurfaceSize.width / 2 + normalizedViewport.translateX;
      const currentCenterY = nextSurfaceSize.height / 2 + normalizedViewport.translateY;
      const contentX = (localX - currentCenterX) / normalizedViewport.scale;
      const contentY = (localY - currentCenterY) / normalizedViewport.scale;
      const nextTranslateX = localX - nextSurfaceSize.width / 2 - contentX * clampedScale;
      const nextTranslateY = localY - nextSurfaceSize.height / 2 - contentY * clampedScale;

      return normalizeViewport(
        {
          scale: clampedScale,
          translateX: nextTranslateX,
          translateY: nextTranslateY,
          isDragging: false
        },
        nextSurfaceSize.width,
        nextSurfaceSize.height,
        nextBoardSize.width,
        nextBoardSize.height
      );
    });
  }

  function zoomByStep(direction: 1 | -1): void {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    if (
      direction === -1 &&
      viewport.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001 &&
      Math.hypot(viewport.translateX, viewport.translateY) > 1
    ) {
      setViewport((currentViewport) => ({
        ...currentViewport,
        scale: MAP_VIEWPORT_MIN_SCALE,
        translateX: 0,
        translateY: 0,
        isDragging: false
      }));
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    zoomTo(
      viewport.scale + direction * MAP_VIEWPORT_BUTTON_STEP,
      surfaceRect.left + surfaceRect.width / 2,
      surfaceRect.top + surfaceRect.height / 2
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
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
    viewportRef.current = viewport;
  }

  function finishPointer(pointerId: number): void {
    if (dragStateRef.current.pointerId !== pointerId) {
      return;
    }

    dragStateRef.current.pointerId = null;
    setViewport((currentViewport) =>
      currentViewport.isDragging
        ? {
            ...currentViewport,
            isDragging: false
          }
        : currentViewport
    );
  }

  function handleTerritoryClick(territoryId: string): void {
    if (dragStateRef.current.suppressClick) {
      dragStateRef.current.suppressClick = false;
      return;
    }

    onTerritorySelect(territoryId);
  }

  const hasViewportOffset = Math.hypot(viewport.translateX, viewport.translateY) > 1;
  const connectionBadgeClassName =
    viewport.scale > MAP_VIEWPORT_MIN_SCALE + 0.001 || hasViewportOffset
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
          "--map-background-image": `url(${snapshot.mapVisual.imageUrl})`
        }
      : {})
  } as CSSProperties;
  const viewportSize = currentSurfaceSize();
  const boardSize = currentBoardSize();
  const markerBoardFrame =
    renderedBoardFrame ||
    ({
      left: viewportSize.width / 2 + viewport.translateX - (boardSize.width * viewport.scale) / 2,
      top: viewportSize.height / 2 + viewport.translateY - (boardSize.height * viewport.scale) / 2,
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
            disabled={viewport.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001 && !hasViewportOffset}
          >
            <span aria-hidden="true">-</span>
          </button>
        </div>

        <div
          ref={handleSurfaceRef}
          className={connectionBadgeClassName}
          data-map-surface=""
          data-map-scale={viewport.scale.toFixed(3)}
          data-map-node-scale={nodeScale.toFixed(4)}
          data-map-translate-x={viewport.translateX.toFixed(2)}
          data-map-translate-y={viewport.translateY.toFixed(2)}
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
