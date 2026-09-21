import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PlacedElement,
  CableRun,
  SignalType,
  SIGNAL_CONFIG,
  EQUIPMENT_CATALOG,
} from './spatial-library';
import {
  Maximize2Icon,
  RotateCwIcon,
  Trash2Icon,
  CopyIcon,
  LockIcon,
  UnlockIcon,
  MoveIcon,
} from 'lucide-react';

interface SpatialStageCanvasProps {
  elements: PlacedElement[];
  cables: CableRun[];
  roomWidth: number; // in meters
  roomHeight: number; // in meters
  gridSize: number; // in meters (0.5 or 1.0)
  snapToGrid: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showFov: boolean;
  showCables: boolean;
  cableDrawingMode: SignalType | null;
  selectedIds: string[];
  unit: 'metric' | 'imperial';
  onSelectElements: (ids: string[]) => void;
  onUpdateElements: (elements: PlacedElement[]) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onAddCable: (fromId: string, toId: string, signalType: SignalType) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export function SpatialStageCanvas({
  elements,
  cables,
  roomWidth,
  roomHeight,
  gridSize,
  snapToGrid,
  showGrid,
  showRulers,
  showFov,
  showCables,
  cableDrawingMode,
  selectedIds,
  unit,
  onSelectElements,
  onUpdateElements,
  onDeleteSelected,
  onDuplicateSelected,
  onAddCable,
  svgRef: externalSvgRef,
}: SpatialStageCanvasProps) {
  // Canvas Viewport Transform
  const [zoom, setZoom] = useState(1.0); // 1 unit = 25 pixels at 1.0 zoom
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Element Interaction State
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'rotate' | 'resize' | 'marquee' | 'cable_start';
    startX: number;
    startY: number;
    initialElements?: PlacedElement[];
    resizeHandle?: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's';
    rotateCenter?: { x: number; y: number };
    cableSourceId?: string;
  } | null>(null);

  const [marqueeRect, setMarqueeRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const internalSvgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const svgRef = externalSvgRef || internalSvgRef;

  // Scale: 1 meter = 24 pixels at zoom = 1.0
  const METERS_TO_PIXELS = 26;
  const scale = METERS_TO_PIXELS * zoom;

  // Coordinate Converters
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = (screenX - rect.left - pan.x) / scale;
      const rawY = (screenY - rect.top - pan.y) / scale;
      return { x: rawX, y: rawY };
    },
    [pan, scale, svgRef]
  );

  const snapValue = (val: number, step: number) => {
    if (!snapToGrid) return Math.round(val * 100) / 100;
    return Math.round(val / step) * step;
  };

  // Zoom Handler with Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 4.0);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered on cursor
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Pointer Down on Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle Click, Alt+Drag or Right Click Pan
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button === 0) {
      const worldPos = screenToWorld(e.clientX, e.clientY);

      // Check if clicking outside any element -> start marquee
      if (!e.shiftKey) {
        onSelectElements([]);
      }
      setDragState({
        mode: 'marquee',
        startX: worldPos.x,
        startY: worldPos.y,
      });
      setMarqueeRect({ x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y });
    }
  };

  // Element Mouse Down
  const handleElementMouseDown = (e: React.MouseEvent, elem: PlacedElement) => {
    e.stopPropagation();

    // If in Cable Routing Mode
    if (cableDrawingMode) {
      if (!dragState || dragState.mode !== 'cable_start') {
        setDragState({
          mode: 'cable_start',
          startX: elem.x + elem.width / 2,
          startY: elem.y + elem.height / 2,
          cableSourceId: elem.id,
        });
      } else if (dragState.cableSourceId && dragState.cableSourceId !== elem.id) {
        onAddCable(dragState.cableSourceId, elem.id, cableDrawingMode);
        setDragState(null);
      }
      return;
    }

    if (e.button === 0) {
      let nextSelected = [...selectedIds];
      if (e.shiftKey) {
        if (nextSelected.includes(elem.id)) {
          nextSelected = nextSelected.filter((id) => id !== elem.id);
        } else {
          nextSelected.push(elem.id);
        }
      } else if (!nextSelected.includes(elem.id)) {
        nextSelected = [elem.id];
      }
      onSelectElements(nextSelected);

      const worldPos = screenToWorld(e.clientX, e.clientY);
      setDragState({
        mode: 'move',
        startX: worldPos.x,
        startY: worldPos.y,
        initialElements: JSON.parse(JSON.stringify(elements)),
      });
    }
  };

  // Rotation Handle Mouse Down
  const handleRotateMouseDown = (e: React.MouseEvent, elem: PlacedElement) => {
    e.stopPropagation();
    const elemCenterX = elem.x + elem.width / 2;
    const elemCenterY = elem.y + elem.height / 2;
    const worldPos = screenToWorld(e.clientX, e.clientY);

    setDragState({
      mode: 'rotate',
      startX: worldPos.x,
      startY: worldPos.y,
      rotateCenter: { x: elemCenterX, y: elemCenterY },
      initialElements: JSON.parse(JSON.stringify(elements)),
    });
  };

  // Resize Handle Mouse Down
  const handleResizeMouseDown = (e: React.MouseEvent, elem: PlacedElement, handle: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's') => {
    e.stopPropagation();
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setDragState({
      mode: 'resize',
      startX: worldPos.x,
      startY: worldPos.y,
      resizeHandle: handle,
      initialElements: JSON.parse(JSON.stringify(elements)),
    });
  };

  // Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!dragState) return;

    const currentWorld = screenToWorld(e.clientX, e.clientY);

    // 1. Marquee Selection
    if (dragState.mode === 'marquee') {
      const x1 = Math.min(dragState.startX, currentWorld.x);
      const y1 = Math.min(dragState.startY, currentWorld.y);
      const x2 = Math.max(dragState.startX, currentWorld.x);
      const y2 = Math.max(dragState.startY, currentWorld.y);
      setMarqueeRect({ x1, y1, x2, y2 });

      const enclosed = elements
        .filter((el) => el.x >= x1 && el.x + el.width <= x2 && el.y >= y1 && el.y + el.height <= y2)
        .map((el) => el.id);
      onSelectElements(enclosed);
      return;
    }

    // 2. Element Drag / Move
    if (dragState.mode === 'move' && dragState.initialElements) {
      const dx = currentWorld.x - dragState.startX;
      const dy = currentWorld.y - dragState.startY;

      const updated = elements.map((el) => {
        if (!selectedIds.includes(el.id) || el.locked) return el;
        const initial = dragState.initialElements?.find((i) => i.id === el.id);
        if (!initial) return el;

        const rawX = initial.x + dx;
        const rawY = initial.y + dy;

        return {
          ...el,
          x: Math.max(0, Math.min(roomWidth - el.width, snapValue(rawX, gridSize))),
          y: Math.max(0, Math.min(roomHeight - el.height, snapValue(rawY, gridSize))),
        };
      });

      onUpdateElements(updated);
      return;
    }

    // 3. Rotation Handle
    if (dragState.mode === 'rotate' && dragState.rotateCenter && dragState.initialElements) {
      const center = dragState.rotateCenter;
      const rad = Math.atan2(currentWorld.y - center.y, currentWorld.x - center.x);
      let deg = Math.round((rad * 180) / Math.PI) + 90;
      if (deg < 0) deg += 360;

      // 15° snap with Shift key
      if (e.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      }

      const updated = elements.map((el) => {
        if (!selectedIds.includes(el.id) || el.locked) return el;
        return { ...el, rotation: deg % 360 };
      });
      onUpdateElements(updated);
      return;
    }

    // 4. Resize Handle
    if (dragState.mode === 'resize' && dragState.initialElements && dragState.resizeHandle) {
      const handle = dragState.resizeHandle;
      const dx = currentWorld.x - dragState.startX;
      const dy = currentWorld.y - dragState.startY;

      const updated = elements.map((el) => {
        if (!selectedIds.includes(el.id) || el.locked) return el;
        const initial = dragState.initialElements?.find((i) => i.id === el.id);
        if (!initial) return el;

        let newW = initial.width;
        let newH = initial.height;
        let newX = initial.x;
        let newY = initial.y;

        if (handle.includes('e')) {
          newW = Math.max(0.5, snapValue(initial.width + dx, gridSize));
        }
        if (handle.includes('s')) {
          newH = Math.max(0.5, snapValue(initial.height + dy, gridSize));
        }
        if (handle.includes('w')) {
          const clampedW = Math.max(0.5, snapValue(initial.width - dx, gridSize));
          newX = initial.x + (initial.width - clampedW);
          newW = clampedW;
        }
        if (handle.includes('n')) {
          const clampedH = Math.max(0.5, snapValue(initial.height - dy, gridSize));
          newY = initial.y + (initial.height - clampedH);
          newH = clampedH;
        }

        return { ...el, x: newX, y: newY, width: newW, height: newH };
      });
      onUpdateElements(updated);
      return;
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    if (dragState?.mode === 'marquee') {
      setMarqueeRect(null);
    }
    setDragState(null);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.length > 0) {
        e.preventDefault();
        onDeleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        onDuplicateSelected();
      }
      if (e.key === 'Escape') {
        onSelectElements([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, onDeleteSelected, onDuplicateSelected, onSelectElements]);

  // Primary Selected Element for Handles
  const primarySelected = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full bg-[#080b11] overflow-hidden select-none cursor-crosshair"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #1a2233 1px, transparent 0)`,
        backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* 2D Vector SVG Stage Workspace */}
      <svg
        ref={svgRef}
        className="w-full h-full absolute inset-0 pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Room Boundary Walls */}
          <rect
            x={0}
            y={0}
            width={roomWidth}
            height={roomHeight}
            fill="#0b0f19"
            stroke="#202b42"
            strokeWidth={0.2}
            strokeDasharray="0.5 0.5"
          />

          {/* Dimension Grid Lines (Optional Sub-Grid) */}
          {showGrid && (
            <g opacity={0.15}>
              {Array.from({ length: Math.ceil(roomWidth / 5) + 1 }).map((_, i) => (
                <line
                  key={`gx-${i}`}
                  x1={i * 5}
                  y1={0}
                  x2={i * 5}
                  y2={roomHeight}
                  stroke="#38bdf8"
                  strokeWidth={0.06}
                />
              ))}
              {Array.from({ length: Math.ceil(roomHeight / 5) + 1 }).map((_, i) => (
                <line
                  key={`gy-${i}`}
                  x1={0}
                  y1={i * 5}
                  x2={roomWidth}
                  y2={i * 5}
                  stroke="#38bdf8"
                  strokeWidth={0.06}
                />
              ))}
            </g>
          )}

          {/* Cable Runs & Power Schematics (Rendered Under Elements) */}
          {showCables &&
            cables.map((cable) => {
              const from = elements.find((e) => e.id === cable.fromElementId);
              const to = elements.find((e) => e.id === cable.toElementId);
              if (!from || !to) return null;

              const x1 = from.x + from.width / 2;
              const y1 = from.y + from.height / 2;
              const x2 = to.x + to.width / 2;
              const y2 = to.y + to.height / 2;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const ctrlY = midY + (midX > roomWidth / 2 ? 1.5 : -1.5);

              const colorConfig = SIGNAL_CONFIG[cable.signalType] || SIGNAL_CONFIG.power;

              return (
                <g key={cable.id} className="cursor-pointer">
                  {/* Cable Glow */}
                  <path
                    d={`M ${x1} ${y1} Q ${midX} ${ctrlY} ${x2} ${y2}`}
                    fill="none"
                    stroke={colorConfig.hex}
                    strokeWidth={0.3}
                    strokeOpacity={0.2}
                  />
                  {/* Cable Core */}
                  <path
                    d={`M ${x1} ${y1} Q ${midX} ${ctrlY} ${x2} ${y2}`}
                    fill="none"
                    stroke={colorConfig.hex}
                    strokeWidth={0.12}
                    strokeDasharray="0.4 0.2"
                    strokeLinecap="round"
                  />
                  {/* Label badge */}
                  <circle cx={midX} cy={ctrlY} r={0.35} fill="#090d16" stroke={colorConfig.hex} strokeWidth={0.06} />
                  <text
                    x={midX}
                    y={ctrlY + 0.1}
                    fill={colorConfig.hex}
                    fontSize={0.25}
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {cable.signalType.charAt(0).toUpperCase()}
                  </text>
                </g>
              );
            })}

          {/* Placed Equipment Elements */}
          {elements.map((elem) => {
            const isSelected = selectedIds.includes(elem.id);
            const centerX = elem.x + elem.width / 2;
            const centerY = elem.y + elem.height / 2;

            return (
              <g
                key={elem.id}
                transform={`translate(${elem.x}, ${elem.y}) rotate(${elem.rotation}, ${elem.width / 2}, ${elem.height / 2})`}
                onMouseDown={(e) => handleElementMouseDown(e, elem)}
                className="cursor-move group"
              >
                {/* Camera FOV Projection Cone */}
                {showFov && elem.category === 'av_broadcast' && elem.shape === 'camera' && (
                  <g opacity={0.25} pointerEvents="none">
                    <path
                      d={`M ${elem.width / 2} ${elem.height / 2} L ${elem.width / 2 - (elem.fovDistance || 14) * Math.tan((((elem.fovAngle || 50) / 2) * Math.PI) / 180)} ${-(elem.fovDistance || 14)} L ${elem.width / 2 + (elem.fovDistance || 14) * Math.tan((((elem.fovAngle || 50) / 2) * Math.PI) / 180)} ${-(elem.fovDistance || 14)} Z`}
                      fill="url(#camFovGradient)"
                      stroke="#2dd4bf"
                      strokeWidth={0.05}
                      strokeDasharray="0.3 0.3"
                    />
                  </g>
                )}

                {/* Main Element Shape Render */}
                {renderElementShape(elem, isSelected)}

                {/* Custom Label & Dimensions */}
                <text
                  x={elem.width / 2}
                  y={elem.height / 2 + 0.08}
                  fill="#ffffff"
                  fontSize={Math.min(0.35, elem.height * 0.45)}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                  className="pointer-events-none drop-shadow"
                >
                  {elem.customLabel || elem.name}
                </text>
              </g>
            );
          })}

          {/* Active Selection Transform Box & Handles */}
          {primarySelected && (
            <g
              transform={`translate(${primarySelected.x}, ${primarySelected.y}) rotate(${primarySelected.rotation}, ${primarySelected.width / 2}, ${primarySelected.height / 2})`}
              pointerEvents="auto"
            >
              {/* Selection Halo Ring */}
              <rect
                x={-0.1}
                y={-0.1}
                width={primarySelected.width + 0.2}
                height={primarySelected.height + 0.2}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={0.08}
                strokeDasharray="0.3 0.2"
                className="animate-pulse"
              />

              {/* Resize Corner Handles */}
              {!primarySelected.locked && (
                <>
                  <rect
                    x={-0.2}
                    y={-0.2}
                    width={0.4}
                    height={0.4}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={0.06}
                    className="cursor-nwse-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, primarySelected, 'nw')}
                  />
                  <rect
                    x={primarySelected.width - 0.2}
                    y={-0.2}
                    width={0.4}
                    height={0.4}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={0.06}
                    className="cursor-nesw-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, primarySelected, 'ne')}
                  />
                  <rect
                    x={primarySelected.width - 0.2}
                    y={primarySelected.height - 0.2}
                    width={0.4}
                    height={0.4}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={0.06}
                    className="cursor-nwse-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, primarySelected, 'se')}
                  />
                  <rect
                    x={-0.2}
                    y={primarySelected.height - 0.2}
                    width={0.4}
                    height={0.4}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={0.06}
                    className="cursor-nesw-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, primarySelected, 'sw')}
                  />

                  {/* Rotation Dial Top Stem */}
                  <line
                    x1={primarySelected.width / 2}
                    y1={-0.1}
                    x2={primarySelected.width / 2}
                    y2={-1.0}
                    stroke="#38bdf8"
                    strokeWidth={0.06}
                  />
                  <circle
                    cx={primarySelected.width / 2}
                    cy={-1.0}
                    r={0.35}
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth={0.08}
                    className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                    onMouseDown={(e) => handleRotateMouseDown(e, primarySelected)}
                  />
                </>
              )}
            </g>
          )}

          {/* Marquee Drag Box */}
          {marqueeRect && (
            <rect
              x={marqueeRect.x1}
              y={marqueeRect.y1}
              width={marqueeRect.x2 - marqueeRect.x1}
              height={marqueeRect.y2 - marqueeRect.y1}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="#38bdf8"
              strokeWidth={0.08}
              strokeDasharray="0.2 0.2"
            />
          )}

          {/* Gradients */}
          <defs>
            <linearGradient id="camFovGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
            </linearGradient>
            <pattern id="ledMatrixPattern" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
              <rect width="0.16" height="0.16" fill="#0369a1" rx="0.02" />
            </pattern>
          </defs>
        </g>
      </svg>

      {/* On-Canvas Precision Rulers */}
      {showRulers && (
        <>
          {/* Top Horizontal Ruler */}
          <div className="absolute top-0 left-0 right-0 h-6 bg-zinc-950/90 border-b border-zinc-800 pointer-events-none flex items-center overflow-hidden font-mono text-[9px] text-zinc-400">
            <div
              className="flex whitespace-nowrap"
              style={{ transform: `translateX(${pan.x}px)` }}
            >
              {Array.from({ length: Math.ceil(roomWidth / 2) + 1 }).map((_, i) => (
                <div
                  key={`ruler-x-${i}`}
                  className="inline-flex items-center border-l border-zinc-700 h-4 pl-1"
                  style={{ width: `${2 * scale}px` }}
                >
                  {i * 2} {unit === 'metric' ? 'm' : 'ft'}
                </div>
              ))}
            </div>
          </div>

          {/* Left Vertical Ruler */}
          <div className="absolute top-6 left-0 bottom-0 w-6 bg-zinc-950/90 border-r border-zinc-800 pointer-events-none flex flex-col overflow-hidden font-mono text-[9px] text-zinc-400">
            <div
              className="flex flex-col whitespace-nowrap"
              style={{ transform: `translateY(${pan.y - 24}px)` }}
            >
              {Array.from({ length: Math.ceil(roomHeight / 2) + 1 }).map((_, i) => (
                <div
                  key={`ruler-y-${i}`}
                  className="border-t border-zinc-700 pt-0.5 pl-0.5"
                  style={{ height: `${2 * scale}px` }}
                >
                  {i * 2}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Floating Canvas View Controls (Bottom-Right) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800 rounded-xl p-1.5 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 text-sm font-bold"
          title="Zoom Out"
        >
          -
        </button>
        <span className="text-xs font-mono text-cyan-400 px-1 font-bold">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(4.0, z + 0.15))}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 text-sm font-bold"
          title="Zoom In"
        >
          +
        </button>
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 60, y: 60 });
          }}
          className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium"
          title="Reset to 100%"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Specialized SVG Shape Renderers
// -------------------------------------------------------------
function renderElementShape(elem: PlacedElement, isSelected: boolean) {
  const strokeColor = isSelected ? '#38bdf8' : elem.color || '#475569';

  switch (elem.shape) {
    // LED Video Wall Matrix
    case 'rect':
      if (elem.category === 'av_broadcast' && elem.defId.includes('led')) {
        return (
          <g>
            <rect
              x={0}
              y={0}
              width={elem.width}
              height={elem.height}
              fill="url(#ledMatrixPattern)"
              stroke="#38bdf8"
              strokeWidth={0.06}
              rx={0.08}
            />
            <rect
              x={0}
              y={0}
              width={elem.width}
              height={elem.height}
              fill="#0284c7"
              fillOpacity={0.4}
              stroke="#7dd3fc"
              strokeWidth={0.04}
            />
          </g>
        );
      }
      return (
        <rect
          x={0}
          y={0}
          width={elem.width}
          height={elem.height}
          fill={elem.color || '#1e293b'}
          stroke={strokeColor}
          strokeWidth={0.08}
          rx={0.12}
        />
      );

    // FOH Console Desk
    case 'desk':
      return (
        <g>
          <rect
            x={0}
            y={0}
            width={elem.width}
            height={elem.height}
            fill="#18181b"
            stroke="#a855f7"
            strokeWidth={0.08}
            rx={0.15}
          />
          {/* Audio faders simulation */}
          {Array.from({ length: 4 }).map((_, i) => (
            <rect
              key={i}
              x={0.4 + i * (elem.width / 4.5)}
              y={0.3}
              width={elem.width / 6}
              height={elem.height - 0.6}
              fill="#27272a"
              stroke="#52525b"
              strokeWidth={0.04}
              rx={0.06}
            />
          ))}
        </g>
      );

    // Broadcast Camera Icon Shape
    case 'camera':
      return (
        <g>
          <rect
            x={0}
            y={0}
            width={elem.width}
            height={elem.height}
            fill="#0f766e"
            stroke="#2dd4bf"
            strokeWidth={0.08}
            rx={0.2}
          />
          {/* Camera Lens Indicator */}
          <polygon
            points={`${elem.width / 2 - 0.2},0.1 ${elem.width / 2 + 0.2},0.1 ${elem.width / 2},-${elem.height * 0.2}`}
            fill="#2dd4bf"
          />
          <circle cx={elem.width / 2} cy={elem.height / 2} r={elem.width / 3.5} fill="#134e4a" stroke="#5eead4" strokeWidth={0.05} />
        </g>
      );

    // PA Speaker Array
    case 'speaker':
      return (
        <g>
          <rect
            x={0}
            y={0}
            width={elem.width}
            height={elem.height}
            fill="#831843"
            stroke="#f43f5e"
            strokeWidth={0.08}
            rx={0.1}
          />
          <circle cx={elem.width / 2} cy={elem.height / 2} r={elem.width / 3} fill="#4c0519" stroke="#fda4af" strokeWidth={0.05} />
        </g>
      );

    // Power / Signal Drop Node
    case 'drop_node':
      return (
        <g>
          <rect
            x={0}
            y={0}
            width={elem.width}
            height={elem.height}
            fill={elem.color || '#78350f'}
            stroke={elem.borderColor || '#f59e0b'}
            strokeWidth={0.08}
            rx={elem.width / 2}
          />
          <circle
            cx={elem.width / 2}
            cy={elem.height / 2}
            r={elem.width / 4}
            fill="#ffffff"
            className="animate-pulse"
          />
        </g>
      );

    // Round Banquet Table
    case 'table_round':
      return (
        <g>
          <circle
            cx={elem.width / 2}
            cy={elem.height / 2}
            r={elem.width / 2}
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth={0.08}
          />
          {/* 8 Chairs around circle */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            const cx = elem.width / 2 + (elem.width / 2 + 0.15) * Math.cos(angle);
            const cy = elem.height / 2 + (elem.height / 2 + 0.15) * Math.sin(angle);
            return <circle key={i} cx={cx} cy={cy} r={0.18} fill="#64748b" stroke="#cbd5e1" strokeWidth={0.03} />;
          })}
        </g>
      );

    // Theater Seating Row
    case 'seating_row':
      return (
        <g>
          <rect
            x={0}
            y={0}
            width={elem.width}
            height={elem.height}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth={0.08}
            rx={0.1}
          />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect
              key={i}
              x={0.1 + i * ((elem.width - 0.2) / 10)}
              y={0.1}
              width={(elem.width - 0.3) / 10}
              height={elem.height - 0.2}
              fill="#334155"
              stroke="#475569"
              strokeWidth={0.02}
              rx={0.05}
            />
          ))}
        </g>
      );

    default:
      return (
        <rect
          x={0}
          y={0}
          width={elem.width}
          height={elem.height}
          fill={elem.color || '#1e293b'}
          stroke={strokeColor}
          strokeWidth={0.08}
          rx={0.1}
        />
      );
  }
}
