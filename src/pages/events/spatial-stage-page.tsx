import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SpatialLayoutData,
  PlacedElement,
  CableRun,
  SignalType,
  EQUIPMENT_CATALOG,
  VENUE_TEMPLATES,
  SpatialCategory,
  SIGNAL_CONFIG,
} from '@/components/spatial/spatial-library';
import { SpatialStageCanvas } from '@/components/spatial/spatial-stage-canvas';
import { BlueprintExportModal } from '@/components/spatial/blueprint-export-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  LayersIcon,
  Maximize2Icon,
  Trash2Icon,
  CopyIcon,
  LockIcon,
  UnlockIcon,
  SaveIcon,
  Undo2Icon,
  Redo2Icon,
  PlusIcon,
  SearchIcon,
  GridIcon,
  EyeIcon,
  ZapIcon,
  UsersIcon,
  TvIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SlidersHorizontalIcon,
  FileCheckIcon,
  CableIcon,
  ArrowLeftIcon,
  RulerIcon,
} from 'lucide-react';
import { getEvent, getSpatialLayout, listEvents, saveSpatialLayout } from '@/lib/api/agency';
import { Event } from '@/types/agency';

function defaultLayout(eventId?: string): SpatialLayoutData {
  return {
    id: `layout_${Date.now()}`,
    eventId,
    title: 'Grand Ballroom Production Layout',
    venueName: 'Metropolitan Convention Center',
    revision: 'Rev 1.0',
    roomWidth: 36,
    roomHeight: 24,
    unit: 'metric',
    gridSize: 1.0,
    elements: VENUE_TEMPLATES[0].data.elements || [],
    cables: VENUE_TEMPLATES[0].data.cables || [],
  };
}

export function SpatialStagePage() {
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Active Layout State — localStorage as instant cache; Postgres wins on load
  const [layout, setLayout] = useState<SpatialLayoutData>(() => {
    const cached = localStorage.getItem(`cosmos_spatial_${eventId || 'default'}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    return defaultLayout(eventId);
  });

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<SpatialLayoutData[]>([layout]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Selection & UI Tooling State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<SpatialCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showFov, setShowFov] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [cableDrawingMode, setCableDrawingMode] = useState<SignalType | null>(null);

  // Panels & Modals
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isBoqOpen, setIsBoqOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Event Linkage
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load Agency Events for Linkage + hydrate layout from Postgres when linked
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await listEvents();
        if (res?.data) {
          setEventsList(res.data);
          if (eventId) {
            const matched = res.data.find((e) => e.id === eventId || e.eventId === eventId);
            if (matched) {
              setLayout((prev) => ({
                ...prev,
                title: prev.title?.includes(matched.name) ? prev.title : `${matched.name} - Stage Layout`,
                venueName: matched.location || prev.venueName,
                eventId: matched.id,
              }));
            }
          }
        }
      } catch (_) {}
    }
    fetchEvents();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    async function hydrateFromServer() {
      try {
        const res = await getSpatialLayout(eventId);
        const serverLayout = res.data?.layout as SpatialLayoutData | null | undefined;
        if (!cancelled && serverLayout && typeof serverLayout === 'object' && Array.isArray(serverLayout.elements)) {
          setLayout(serverLayout);
          setHistory([serverLayout]);
          setHistoryIndex(0);
          localStorage.setItem(`cosmos_spatial_${eventId}`, JSON.stringify(serverLayout));
          return;
        }
        // Fallback: event metadata may already carry layout via getEvent
        const eventRes = await getEvent(eventId);
        const metaLayout = eventRes.data?.metadata?.spatialLayout as SpatialLayoutData | undefined;
        if (!cancelled && metaLayout && Array.isArray(metaLayout.elements)) {
          setLayout(metaLayout);
          setHistory([metaLayout]);
          setHistoryIndex(0);
          localStorage.setItem(`cosmos_spatial_${eventId}`, JSON.stringify(metaLayout));
        }
      } catch (_) {
        // Keep localStorage / template layout
      }
    }
    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Push to History Stack
  const pushState = (newLayout: SpatialLayoutData) => {
    setLayout(newLayout);
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(JSON.parse(JSON.stringify(newLayout)));
    if (newHist.length > 30) newHist.shift();
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setLayout(JSON.parse(JSON.stringify(history[nextIdx])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setLayout(JSON.parse(JSON.stringify(history[nextIdx])));
    }
  };

  // Add Element from Catalog
  const handleAddElement = (defId: string) => {
    const def = EQUIPMENT_CATALOG.find((d) => d.id === defId);
    if (!def) return;

    const newElem: PlacedElement = {
      id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      defId: def.id,
      name: def.name,
      category: def.category,
      x: Math.round(layout.roomWidth / 2 - def.defaultWidth / 2),
      y: Math.round(layout.roomHeight / 2 - def.defaultHeight / 2),
      width: def.defaultWidth,
      height: def.defaultHeight,
      rotation: 0,
      color: def.color,
      shape: def.shape,
      layer: layout.elements.length + 1,
      powerDrawWatts: def.defaultPowerDrawWatts,
      signalType: def.metadata?.signalType,
      fovAngle: def.metadata?.fovAngle,
      fovDistance: def.metadata?.fovDistance,
      seatCount: def.metadata?.seatCount,
    };

    const nextElements = [...layout.elements, newElem];
    pushState({ ...layout, elements: nextElements });
    setSelectedIds([newElem.id]);

    toast.success(`Added ${def.name}`, {
      description: 'Placed at center of stage canvas. Drag to reposition.',
    });
  };

  // Update Elements on Canvas
  const handleUpdateElements = (updatedElements: PlacedElement[]) => {
    setLayout((prev) => ({ ...prev, elements: updatedElements }));
  };

  // Delete Selected Elements
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const nextElements = layout.elements.filter((e) => !selectedIds.includes(e.id));
    const nextCables = layout.cables.filter(
      (c) => !selectedIds.includes(c.fromElementId) && !selectedIds.includes(c.toElementId)
    );
    pushState({ ...layout, elements: nextElements, cables: nextCables });
    setSelectedIds([]);
  };

  // Duplicate Selected Elements
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const duplicates: PlacedElement[] = [];
    const newSelectedIds: string[] = [];

    layout.elements.forEach((elem) => {
      if (selectedIds.includes(elem.id)) {
        const copy: PlacedElement = {
          ...JSON.parse(JSON.stringify(elem)),
          id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          x: Math.min(layout.roomWidth - elem.width, elem.x + 1),
          y: Math.min(layout.roomHeight - elem.height, elem.y + 1),
        };
        duplicates.push(copy);
        newSelectedIds.push(copy.id);
      }
    });

    pushState({ ...layout, elements: [...layout.elements, ...duplicates] });
    setSelectedIds(newSelectedIds);
  };

  // Add Cable Connection
  const handleAddCable = (fromId: string, toId: string, signalType: SignalType) => {
    const from = layout.elements.find((e) => e.id === fromId);
    const to = layout.elements.find((e) => e.id === toId);
    if (!from || !to) return;

    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const estLength = Math.round(Math.sqrt(dx * dx + dy * dy) * 1.2 * 10) / 10;

    const newCable: CableRun = {
      id: `cable_${Date.now()}`,
      name: `${from.name} ➔ ${to.name} (${SIGNAL_CONFIG[signalType].label})`,
      signalType,
      fromElementId: fromId,
      toElementId: toId,
      lengthMeters: estLength,
    };

    pushState({ ...layout, cables: [...layout.cables, newCable] });
    setCableDrawingMode(null);

    toast.success('⚡ Cable Run Connected', {
      description: `${newCable.name} (~${estLength}m run)`,
    });
  };

  // Apply Venue Template
  const handleApplyTemplate = (tplId: string) => {
    const tpl = VENUE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    const nextLayout: SpatialLayoutData = {
      ...layout,
      title: tpl.data.title || layout.title,
      venueName: tpl.data.venueName || layout.venueName,
      roomWidth: tpl.data.roomWidth || layout.roomWidth,
      roomHeight: tpl.data.roomHeight || layout.roomHeight,
      elements: tpl.data.elements || [],
      cables: tpl.data.cables || [],
    };
    pushState(nextLayout);
    setSelectedIds([]);

    toast.success(`Loaded Template: ${tpl.name}`, {
      description: tpl.description,
    });
  };

  // Technical Calculations (BoQ)
  const totalStageDecks = useMemo(() => {
    return layout.elements.reduce((acc, el) => {
      if (el.category === 'staging' && el.shape === 'rect') {
        const area = el.width * el.height;
        return acc + Math.ceil(area / (2.44 * 1.22)); // standard 4x8ft deck area
      }
      return acc;
    }, 0);
  }, [layout.elements]);

  const totalLedAreaSqMeters = useMemo(() => {
    return layout.elements.reduce((acc, el) => {
      if (el.category === 'av_broadcast' && el.defId.includes('led')) {
        return acc + el.width * el.height;
      }
      return acc;
    }, 0);
  }, [layout.elements]);

  const totalPowerWatts = useMemo(() => {
    return layout.elements.reduce((acc, el) => acc + (el.powerDrawWatts || 0), 0);
  }, [layout.elements]);

  const totalSeats = useMemo(() => {
    return layout.elements.reduce((acc, el) => acc + (el.seatCount || 0), 0);
  }, [layout.elements]);

  const totalCableMeters = useMemo(() => {
    return layout.cables.reduce((acc, c) => acc + (c.lengthMeters || 0), 0);
  }, [layout.cables]);

  const estimatedBoqCost = useMemo(() => {
    // Rough production estimate for budget handoff (decks, LED, power, cable, seats)
    return Math.round(
      totalStageDecks * 150 +
        totalLedAreaSqMeters * 800 +
        totalPowerWatts * 0.35 +
        totalCableMeters * 8 +
        totalSeats * 12,
    );
  }, [totalStageDecks, totalLedAreaSqMeters, totalPowerWatts, totalCableMeters, totalSeats]);

  const filteredCatalog = useMemo(() => {
    return EQUIPMENT_CATALOG.filter((item) => {
      const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [categoryFilter, searchQuery]);

  // Save Layout to Postgres (localStorage as offline cache)
  const handleSave = async () => {
    const targetEventId = layout.eventId || eventId;
    const boqSnapshot = {
      totalStageDecks,
      totalLedAreaSqMeters: Number(totalLedAreaSqMeters.toFixed(2)),
      totalPowerWatts,
      totalSeats,
      totalCableMeters: Number(totalCableMeters.toFixed(1)),
      estimatedCost: estimatedBoqCost,
      currency: 'USD',
      computedAt: new Date().toISOString(),
    };

    localStorage.setItem(`cosmos_spatial_${targetEventId || 'default'}`, JSON.stringify(layout));

    if (!targetEventId) {
      toast.success('Layout Saved Locally', {
        description: 'Link this layout to an event to persist BoQ to Postgres.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await saveSpatialLayout(targetEventId, {
        layout: layout as unknown as Record<string, unknown>,
        boqSnapshot,
      });
      const budgetNote = res.data?.budget?.planned
        ? ` · Project budget synced to $${res.data.budget.planned.toLocaleString()}`
        : '';
      toast.success('Layout Saved', {
        description: `Stage floorplan + BoQ persisted to Postgres${budgetNote}`,
      });
    } catch (err) {
      toast.error('Saved locally only', {
        description: err instanceof Error ? err.message : 'Could not reach server — retry when online.',
      });
    } finally {
      setSaving(false);
    }
  };

  const primarySelected = selectedIds.length === 1 ? layout.elements.find((e) => e.id === selectedIds[0]) : null;

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-[#090d16] text-zinc-100 overflow-hidden select-none font-sans">
      {/* ------------------------------------------------------------- */}
      {/* Top Header Toolstrip & Actions Bar */}
      {/* ------------------------------------------------------------- */}
      <header className="min-h-14 border-b border-zinc-800/80 bg-zinc-950/90 px-3 sm:px-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 z-20 backdrop-blur-md py-2">
        {/* Left: Event & Venue Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(eventId ? `/events/${eventId}` : '/events')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800/60 h-8 w-8 shrink-0"
            title="Back to Event"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <LayersIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={layout.title}
                  onChange={(e) => pushState({ ...layout, title: e.target.value })}
                  className="bg-transparent font-bold text-sm text-white focus:bg-zinc-900 px-1.5 py-0.5 rounded border border-transparent focus:border-zinc-700 outline-none w-40 sm:w-64 truncate"
                  placeholder="Stage Layout Name"
                />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-medium shrink-0">
                  {layout.revision}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono pl-1.5 truncate">
                {layout.venueName} • {layout.roomWidth}m × {layout.roomHeight}m
              </div>
            </div>
          </div>
        </div>

        {/* Center: Tools, Snapping, Cables & Views */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl overflow-x-auto max-w-full order-3 lg:order-none basis-full lg:basis-auto">
          <Button
            size="sm"
            variant={cableDrawingMode === null ? 'secondary' : 'ghost'}
            onClick={() => setCableDrawingMode(null)}
            className="h-7 text-xs px-2.5 font-medium shrink-0"
          >
            <Maximize2Icon className="w-3.5 h-3.5 mr-1 text-zinc-400" />
            Select & Move
          </Button>

          {/* Cable Draw Signal Trigger */}
          <Button
            size="sm"
            variant={cableDrawingMode ? 'default' : 'ghost'}
            onClick={() => setCableDrawingMode((prev) => (prev ? null : 'power'))}
            className={`h-7 text-xs px-2.5 font-medium shrink-0 ${
              cableDrawingMode ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-zinc-400'
            }`}
          >
            <CableIcon className="w-3.5 h-3.5 mr-1" />
            {cableDrawingMode ? `Routing ${SIGNAL_CONFIG[cableDrawingMode].label}` : 'Draw Cables'}
          </Button>

          <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

          {/* Snap to Grid Toggle */}
          <Button
            size="sm"
            variant={snapToGrid ? 'secondary' : 'ghost'}
            onClick={() => setSnapToGrid(!snapToGrid)}
            className="h-7 text-xs px-2 text-zinc-300 shrink-0"
            title="Toggle Snap to Grid (1m)"
          >
            <GridIcon className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Snap {snapToGrid ? 'ON' : 'OFF'}
          </Button>

          <Button
            size="sm"
            variant={showGrid ? 'secondary' : 'ghost'}
            onClick={() => setShowGrid(!showGrid)}
            className="h-7 text-xs px-2 text-zinc-300 shrink-0"
            title="Toggle Grid"
          >
            <GridIcon className="w-3.5 h-3.5 mr-1 text-zinc-400" />
            Grid
          </Button>

          <Button
            size="sm"
            variant={showRulers ? 'secondary' : 'ghost'}
            onClick={() => setShowRulers(!showRulers)}
            className="h-7 text-xs px-2 text-zinc-300 shrink-0"
            title="Toggle Rulers"
          >
            <RulerIcon className="w-3.5 h-3.5 mr-1 text-zinc-400" />
            Rulers
          </Button>

          {/* Camera FOV Toggle */}
          <Button
            size="sm"
            variant={showFov ? 'secondary' : 'ghost'}
            onClick={() => setShowFov(!showFov)}
            className="h-7 text-xs px-2 text-zinc-300 shrink-0"
            title="Toggle Camera FOV Cones"
          >
            <EyeIcon className="w-3.5 h-3.5 mr-1 text-teal-400" />
            FOV
          </Button>

          {/* Cables View Toggle */}
          <Button
            size="sm"
            variant={showCables ? 'secondary' : 'ghost'}
            onClick={() => setShowCables(!showCables)}
            className="h-7 text-xs px-2 text-zinc-300 shrink-0"
            title="Toggle Cable Layer"
          >
            <ZapIcon className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Runs ({layout.cables.length})
          </Button>

          <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

          {/* Undo / Redo */}
          <Button
            size="icon"
            variant="ghost"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            className="h-7 w-7 text-zinc-400 disabled:opacity-30 shrink-0"
            title="Undo (Ctrl+Z)"
          >
            <Undo2Icon className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            className="h-7 w-7 text-zinc-400 disabled:opacity-30 shrink-0"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2Icon className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Right: Venue Template, Specs & Export */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Link layout to an event when opened from /spatial-stage */}
          {!eventId && eventsList.length > 0 ? (
            <select
              value={layout.eventId || ''}
              onChange={(e) => {
                const nextId = e.target.value || undefined;
                const matched = eventsList.find((ev) => ev.id === nextId || ev.eventId === nextId);
                pushState({
                  ...layout,
                  eventId: nextId,
                  title: matched ? `${matched.name} - Stage Layout` : layout.title,
                  venueName: matched?.location || layout.venueName,
                });
                if (nextId) navigate(`/events/${nextId}/spatial-stage`);
              }}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-indigo-500 font-medium max-w-[11rem]"
            >
              <option value="">Link to event…</option>
              {eventsList.map((ev) => (
                <option key={ev.eventId || ev.id} value={ev.id || ev.eventId}>
                  {ev.name}
                </option>
              ))}
            </select>
          ) : null}

          {/* Preset Venue Template Loader */}
          <select
            onChange={(e) => e.target.value && handleApplyTemplate(e.target.value)}
            defaultValue=""
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-indigo-500 font-medium"
          >
            <option value="" disabled>
              Load Venue Template...
            </option>
            {VENUE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Live BoQ Specs Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsBoqOpen(!isBoqOpen)}
            className={`border-zinc-700 text-xs h-8 ${isBoqOpen ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500' : 'bg-zinc-900 text-zinc-300'}`}
          >
            <SlidersHorizontalIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            BoQ Specs
          </Button>

          {/* Save Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white text-xs h-8"
          >
            <SaveIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            {saving ? 'Saving…' : 'Save'}
          </Button>

          {/* Export Blueprint */}
          <Button
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs h-8 shadow-lg shadow-cyan-600/20"
          >
            <FileCheckIcon className="w-3.5 h-3.5 mr-1.5" />
            Export Blueprint
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Studio Workspace Layout (3-Column Shell) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-1 relative min-h-0 overflow-hidden">
        {/* Left: Equipment Library Catalog Sidebar */}
        <aside
          className={`${
            isCatalogOpen ? 'w-72' : 'w-10'
          } border-r border-zinc-800 bg-zinc-950 flex flex-col transition-all duration-200 relative shrink-0 z-10`}
        >
          {isCatalogOpen ? (
            <div className="flex flex-col h-full min-h-0 w-72">
              {/* Catalog Search & Category Tabs */}
              <div className="p-3 border-b border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                    <LayersIcon className="w-3.5 h-3.5 text-indigo-400" /> Equipment Catalog
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{filteredCatalog.length} items</span>
                </div>

                {/* Search */}
                <div className="relative">
                  <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search decks, cameras, LED..."
                    className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>

                {/* Categories */}
                <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'staging', label: 'Stage' },
                    { id: 'av_broadcast', label: 'AV/LED' },
                    { id: 'audio_lighting', label: 'Sound/Lights' },
                    { id: 'power_signal', label: 'Drops' },
                    { id: 'seating_venue', label: 'Seating' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id as any)}
                      className={`px-2 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                        categoryFilter === cat.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment Item List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddElement(item.id)}
                    className="group flex items-start gap-3 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900 hover:border-indigo-500/50 cursor-pointer transition-all duration-150"
                  >
                    {/* Visual Shape Miniature */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-zinc-700 shadow-inner"
                      style={{ backgroundColor: item.color }}
                    >
                      <PlusIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">{item.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-400">
                        <span>
                          {item.defaultWidth}m × {item.defaultHeight}m
                        </span>
                        {item.defaultPowerDrawWatts && (
                          <span className="text-amber-400/80 font-bold">
                            {(item.defaultPowerDrawWatts / 1000).toFixed(1)} kW
                          </span>
                        )}
                        {item.metadata?.seatCount && (
                          <span className="text-emerald-400/80 font-bold">
                            {item.metadata.seatCount} Seats
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-10 flex-col items-center pt-3">
              <button
                onClick={() => setIsCatalogOpen(true)}
                className="w-7 h-10 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center"
                title="Open equipment catalog"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {isCatalogOpen ? (
            <button
              onClick={() => setIsCatalogOpen(false)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-10 rounded-md border border-zinc-700 bg-zinc-900/90 text-zinc-400 hover:text-white z-30 flex items-center justify-center"
              title="Collapse catalog"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          ) : null}
        </aside>

        {/* Center: Interactive 2D Vector Canvas */}
        <main className="flex-1 relative min-h-0 h-full overflow-hidden">
          <SpatialStageCanvas
            elements={layout.elements}
            cables={layout.cables}
            roomWidth={layout.roomWidth}
            roomHeight={layout.roomHeight}
            gridSize={layout.gridSize}
            snapToGrid={snapToGrid}
            showGrid={showGrid}
            showRulers={showRulers}
            showFov={showFov}
            showCables={showCables}
            cableDrawingMode={cableDrawingMode}
            selectedIds={selectedIds}
            unit={layout.unit}
            onSelectElements={setSelectedIds}
            onUpdateElements={handleUpdateElements}
            onDeleteSelected={handleDeleteSelected}
            onDuplicateSelected={handleDuplicateSelected}
            onAddCable={handleAddCable}
            svgRef={svgRef}
          />
        </main>

        {/* Right: Property Inspector Sidebar */}
        <aside
          className={`${
            isInspectorOpen ? 'w-80' : 'w-10'
          } border-l border-zinc-800 bg-zinc-950 flex flex-col transition-all duration-200 relative shrink-0 z-10`}
        >
          {isInspectorOpen ? (
            <div className="flex flex-col h-full min-h-0 w-80">
              <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <SlidersHorizontalIcon className="w-3.5 h-3.5 text-cyan-400" /> Properties & Inspector
                </span>
                {primarySelected && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const updated = layout.elements.map((el) =>
                        el.id === primarySelected.id ? { ...el, locked: !el.locked } : el
                      );
                      pushState({ ...layout, elements: updated });
                    }}
                    className="h-6 w-6 text-zinc-400 hover:text-white"
                  >
                    {primarySelected.locked ? <LockIcon className="w-3 h-3 text-amber-400" /> : <UnlockIcon className="w-3 h-3" />}
                  </Button>
                )}
              </div>

              {primarySelected ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Element Name & Custom Label */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">Element Label</Label>
                    <Input
                      value={primarySelected.customLabel || primarySelected.name}
                      onChange={(e) => {
                        const updated = layout.elements.map((el) =>
                          el.id === primarySelected.id ? { ...el, customLabel: e.target.value } : el
                        );
                        pushState({ ...layout, elements: updated });
                      }}
                      className="h-8 text-xs bg-zinc-900 border-zinc-700 text-white"
                    />
                  </div>

                  {/* Transform Dimensions (X, Y, W, H) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-mono text-zinc-400">POS X (Meters)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={primarySelected.x}
                        onChange={(e) => {
                          const updated = layout.elements.map((el) =>
                            el.id === primarySelected.id ? { ...el, x: parseFloat(e.target.value) || 0 } : el
                          );
                          pushState({ ...layout, elements: updated });
                        }}
                        className="h-7 text-xs bg-zinc-900 border-zinc-700 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-mono text-zinc-400">POS Y (Meters)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={primarySelected.y}
                        onChange={(e) => {
                          const updated = layout.elements.map((el) =>
                            el.id === primarySelected.id ? { ...el, y: parseFloat(e.target.value) || 0 } : el
                          );
                          pushState({ ...layout, elements: updated });
                        }}
                        className="h-7 text-xs bg-zinc-900 border-zinc-700 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-mono text-zinc-400">WIDTH (Meters)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={primarySelected.width}
                        onChange={(e) => {
                          const updated = layout.elements.map((el) =>
                            el.id === primarySelected.id ? { ...el, width: Math.max(0.5, parseFloat(e.target.value) || 0.5) } : el
                          );
                          pushState({ ...layout, elements: updated });
                        }}
                        className="h-7 text-xs bg-zinc-900 border-zinc-700 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-mono text-zinc-400">DEPTH (Meters)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={primarySelected.height}
                        onChange={(e) => {
                          const updated = layout.elements.map((el) =>
                            el.id === primarySelected.id ? { ...el, height: Math.max(0.5, parseFloat(e.target.value) || 0.5) } : el
                          );
                          pushState({ ...layout, elements: updated });
                        }}
                        className="h-7 text-xs bg-zinc-900 border-zinc-700 text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Rotation Dial */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-zinc-300">Rotation Angle</span>
                      <span className="font-mono text-cyan-400 font-bold">{primarySelected.rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={primarySelected.rotation}
                      onChange={(e) => {
                        const updated = layout.elements.map((el) =>
                          el.id === primarySelected.id ? { ...el, rotation: parseInt(e.target.value) } : el
                        );
                        pushState({ ...layout, elements: updated });
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between gap-1">
                      {[0, 45, 90, 180, 270].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => {
                            const updated = layout.elements.map((el) =>
                              el.id === primarySelected.id ? { ...el, rotation: deg } : el
                            );
                            pushState({ ...layout, elements: updated });
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono hover:bg-zinc-800"
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Technical Parameters */}
                  {primarySelected.powerDrawWatts !== undefined && (
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                      <Label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                        <ZapIcon className="w-3.5 h-3.5" /> Power Rating (Watts)
                      </Label>
                      <Input
                        type="number"
                        step="100"
                        value={primarySelected.powerDrawWatts}
                        onChange={(e) => {
                          const updated = layout.elements.map((el) =>
                            el.id === primarySelected.id ? { ...el, powerDrawWatts: parseInt(e.target.value) || 0 } : el
                          );
                          pushState({ ...layout, elements: updated });
                        }}
                        className="h-8 text-xs bg-zinc-900 border-zinc-700 text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="pt-4 border-t border-zinc-800 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDuplicateSelected}
                      className="flex-1 text-xs border-zinc-700 bg-zinc-900"
                    >
                      <CopyIcon className="w-3.5 h-3.5 mr-1" />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteSelected}
                      className="flex-1 text-xs"
                    >
                      <Trash2Icon className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                  <Maximize2Icon className="w-8 h-8 mb-2 opacity-30" />
                  <div className="text-xs font-medium text-zinc-400">No Item Selected</div>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                    Click any element on the floorplan to inspect coordinates, rotation, power, and cables.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-10 flex-col items-center pt-3">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="w-7 h-10 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center"
                title="Open inspector"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {isInspectorOpen ? (
            <button
              onClick={() => setIsInspectorOpen(false)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-10 rounded-md border border-zinc-700 bg-zinc-900/90 text-zinc-400 hover:text-white z-30 flex items-center justify-center"
              title="Collapse inspector"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : null}
        </aside>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Bottom Technical Spec & Bill of Quantities Drawer */}
      {/* ------------------------------------------------------------- */}
      {isBoqOpen && (
        <div className="h-48 border-t border-zinc-800 bg-zinc-950/95 p-4 shrink-0 flex flex-col justify-between z-20 shadow-2xl overflow-y-auto">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800 gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <SlidersHorizontalIcon className="w-4 h-4" /> Live Technical Bill of Quantities (BoQ)
            </span>
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 shrink-0">
              <span>Assets: {layout.elements.length}</span>
              <span className="text-emerald-400 font-bold">Est. ${estimatedBoqCost.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 py-2">
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <LayersIcon className="w-3.5 h-3.5 text-indigo-400" /> Stage Decks
              </div>
              <div className="text-lg font-black text-white font-mono mt-1">{totalStageDecks} Decks (4x8ft)</div>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <TvIcon className="w-3.5 h-3.5 text-cyan-400" /> LED Screen Area
              </div>
              <div className="text-lg font-black text-cyan-300 font-mono mt-1">{totalLedAreaSqMeters.toFixed(1)} m²</div>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <ZapIcon className="w-3.5 h-3.5 text-amber-400" /> Power Load
              </div>
              <div className="text-lg font-black text-amber-300 font-mono mt-1">
                {(totalPowerWatts / 1000).toFixed(1)} kW / {((totalPowerWatts / 208) * 1.732).toFixed(0)}A
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <UsersIcon className="w-3.5 h-3.5 text-emerald-400" /> Seating Capacity
              </div>
              <div className="text-lg font-black text-emerald-300 font-mono mt-1">{totalSeats} Seats</div>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <CableIcon className="w-3.5 h-3.5 text-fuchsia-400" /> Cable Runs
              </div>
              <div className="text-lg font-black text-fuchsia-300 font-mono mt-1">
                {layout.cables.length} Runs (~{totalCableMeters.toFixed(0)}m)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Export Dialog */}
      <BlueprintExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        layout={layout}
        svgElementRef={svgRef}
        totalSeats={totalSeats}
        totalPowerWatts={totalPowerWatts}
        totalStageDecks={totalStageDecks}
        totalLedAreaSqMeters={totalLedAreaSqMeters}
      />
    </div>
  );
}
