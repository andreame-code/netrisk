import {
  useCallback,
  useEffect,
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
  surfaceHeight: number
): { x: number; y: number } {
  if (surfaceWidth <= 0 || surfaceHeight <= 0) {
    return { x: translateX, y: translateY };
  }

  const overflowX = Math.max(0, (surfaceWidth * scale - surfaceWidth) / 2);
  const overflowY = Math.max(0, (surfaceHeight * scale - surfaceHeight) / 2);

  return {
    x: clampNumber(translateX, -overflowX, overflowX),
    y: clampNumber(translateY, -overflowY, overflowY)
  };
}

function normalizeViewport(
  viewport: ViewportState,
  surfaceWidth: number,
  surfaceHeight: number
): ViewportState {
  const scale = clampNumber(viewport.scale, MAP_VIEWPORT_MIN_SCALE, MAP_VIEWPORT_MAX_SCALE);
  const clampedTranslation = clampTranslation(
    viewport.translateX,
    viewport.translateY,
    scale,
    surfaceWidth,
    surfaceHeight
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

  return "16 / 10";
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

    function measureSurface(): void {
      setSurfaceSize({
        width: surface.clientWidth,
        height: surface.clientHeight
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
    observer.observe(surface);

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

      if (viewportRef.current.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001) {
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
      setViewport((currentViewport) =>
        normalizeViewport(
          {
            ...currentViewport,
            translateX: dragStateRef.current.startTranslateX + deltaX,
            translateY: dragStateRef.current.startTranslateY + deltaY,
            isDragging: true
          },
          nextSurfaceSize.width,
          nextSurfaceSize.height
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
      normalizeViewport(currentViewport, surfaceSize.width, surfaceSize.height)
    );
  }, [surfaceSize.height, surfaceSize.width]);

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
    if (!surface || nextSurfaceSize.width <= 0 || nextSurfaceSize.height <= 0) {
      return;
    }

    setViewport((currentViewport) => {
      const normalizedViewport = normalizeViewport(
        currentViewport,
        nextSurfaceSize.width,
        nextSurfaceSize.height
      );
      const clampedScale = clampNumber(nextScale, MAP_VIEWPORT_MIN_SCALE, MAP_VIEWPORT_MAX_SCALE);
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
        nextSurfaceSize.height
      );
    });
  }

  function zoomByStep(direction: 1 | -1): void {
    const surface = surfaceRef.current;
    if (!surface) {
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

  const connectionBadgeClassName =
    viewport.scale > MAP_VIEWPORT_MIN_SCALE + 0.001
      ? viewport.isDragging
        ? "map-board-surface is-zoomed is-dragging"
        : "map-board-surface is-zoomed"
      : "map-board-surface";
  const nodeScale = viewport.scale > 0 ? 1 / viewport.scale : 1;
  const boardStyle: CSSProperties = {
    aspectRatio: mapAspectRatio(snapshot),
    ...(snapshot.mapVisual?.imageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(15, 22, 36, 0.18), rgba(15, 22, 36, 0.18)), url(${snapshot.mapVisual.imageUrl})`
        }
      : {})
  };

  return (
    <div className="game-map-stage" data-testid="map-region">
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
            disabled={viewport.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001}
          >
            <span aria-hidden="true">-</span>
          </button>
        </div>

        <div
          ref={handleSurfaceRef}
          className={connectionBadgeClassName}
          data-map-surface=""
          data-map-scale={viewport.scale.toFixed(3)}
          data-map-node-scale="1.0000"
          data-map-translate-x={viewport.translateX.toFixed(2)}
          data-map-translate-y={viewport.translateY.toFixed(2)}
          style={
            {
              aspectRatio: mapAspectRatio(snapshot),
              "--map-territory-node-scale": nodeScale.toFixed(4)
            } as CSSProperties
          }
          onPointerDown={handlePointerDown}
        >
          <div
            className="map-board-transform"
            data-map-transform
            style={{
              transform: `translate(${viewport.translateX}px, ${viewport.translateY}px) scale(${viewport.scale})`
            }}
          >
            <div
              id="map"
              className={`game-map-board map-board ${pieceSkinClass}${snapshot.mapVisual?.imageUrl ? " has-image has-custom-background" : ""}`}
              style={boardStyle}
            >
              <svg className="game-map-connections" viewBox="0 0 1000 1000" aria-hidden="true">
                {(snapshot.map || []).flatMap((territory) => {
                  const territoryX = territory.x;
                  const territoryY = territory.y;
                  if (territoryX == null || territoryY == null) {
                    return [];
                  }

                  return territory.neighbors
                    .filter((neighborId) => territory.id < neighborId)
                    .map((neighborId) => {
                      const target = snapshot.map.find((entry) => entry.id === neighborId);
                      if (!target || target.x == null || target.y == null) {
                        return null;
                      }

                      return (
                        <line
                          key={`${territory.id}-${neighborId}`}
                          x1={territoryX * 1000}
                          y1={territoryY * 1000}
                          x2={target.x * 1000}
                          y2={target.y * 1000}
                        />
                      );
                    });
                })}
              </svg>

              {(snapshot.map || []).map((territory) => {
                const isMine = territory.ownerId === myPlayerId;
                const isAttackSource = territory.id === attackFromId;
                const isAttackTarget = territory.id === attackToId;
                const isReinforceTarget = territory.id === reinforceTerritoryId;
                const isFortifySource = territory.id === fortifyFromId;
                const isFortifyTarget = territory.id === fortifyToId;
                const territoryStyle: CSSProperties & {
                  "--territory-player-color": string;
                } = {
                  left: `${(territory.x ?? 0.5) * 100}%`,
                  top: `${(territory.y ?? 0.5) * 100}%`,
                  "--territory-player-color":
                    territory.ownerId && playersById[territory.ownerId]?.color
                      ? playersById[territory.ownerId].color
                      : "rgba(22, 32, 51, 0.7)"
                };

                return (
                  <button
                    key={territory.id}
                    type="button"
                    className={`territory-node ${pieceSkinClass}${isMine ? " is-mine" : ""}${isAttackSource ? " is-source" : ""}${isAttackTarget ? " is-target" : ""}${isReinforceTarget ? " is-reinforce" : ""}${isFortifySource ? " is-fortify-source" : ""}${isFortifyTarget ? " is-fortify-target" : ""}`}
                    data-territory-id={territory.id}
                    style={territoryStyle}
                    title={territory.name}
                    onClick={() => handleTerritoryClick(territory.id)}
                  >
                    <strong>{territory.name}</strong>
                    <span>{territoryOwnerName(territory, playersById)}</span>
                    <span className="territory-armies">{territory.armies}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
