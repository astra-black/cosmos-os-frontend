import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DownloadIcon,
  PrinterIcon,
  FileCheckIcon,
  LayersIcon,
  ZapIcon,
  UsersIcon,
  RadioIcon,
  SparklesIcon,
} from 'lucide-react';
import { SpatialLayoutData, SIGNAL_CONFIG } from './spatial-library';

interface BlueprintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: SpatialLayoutData;
  svgElementRef: React.RefObject<SVGSVGElement | null>;
  totalSeats: number;
  totalPowerWatts: number;
  totalStageDecks: number;
  totalLedAreaSqMeters: number;
}

export function BlueprintExportModal({
  open,
  onOpenChange,
  layout,
  svgElementRef,
  totalSeats,
  totalPowerWatts,
  totalStageDecks,
  totalLedAreaSqMeters,
}: BlueprintExportModalProps) {
  const [designerName, setDesignerName] = useState('Technical Director');
  const [agencyName, setAgencyName] = useState('Astra Cosmos Live Operations');
  const [sheetRevision, setSheetRevision] = useState(layout.revision || 'Rev 1.0');
  const [includeSchematics, setIncludeSchematics] = useState(true);
  const [includeSignoffs, setIncludeSignoffs] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSvg = () => {
    if (!svgElementRef.current) return;
    const svgClone = svgElementRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${layout.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_stage_blueprint.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 text-zinc-100 border-zinc-800 p-6">
        <DialogHeader className="border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Export Technical Stage Blueprint
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-medium">
                  CAD / PDF Vector
                </span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs mt-0.5">
                Generate production-ready architectural floorplan sheets with engineering title blocks and sign-offs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Configuration Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Technical Director / Drafter</Label>
            <Input
              value={designerName}
              onChange={(e) => setDesignerName(e.target.value)}
              className="bg-zinc-950 border-zinc-700 text-xs h-8 text-white focus:border-cyan-500"
              placeholder="e.g. Lead Technical Producer"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Agency / Production Company</Label>
            <Input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="bg-zinc-950 border-zinc-700 text-xs h-8 text-white focus:border-cyan-500"
              placeholder="e.g. Astra Cosmos Production Group"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Blueprint Revision Code</Label>
            <Input
              value={sheetRevision}
              onChange={(e) => setSheetRevision(e.target.value)}
              className="bg-zinc-950 border-zinc-700 text-xs h-8 text-white focus:border-cyan-500"
              placeholder="Rev 1.0"
            />
          </div>
        </div>

        {/* Blueprint Preview Frame */}
        <div
          ref={printAreaRef}
          className="border-2 border-cyan-500/40 rounded-xl bg-[#090d16] p-5 shadow-2xl relative overflow-hidden"
          style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        >
          {/* Blueprint Watermark / Corner Stamp */}
          <div className="flex justify-between items-start border-b border-cyan-500/30 pb-3 mb-4">
            <div>
              <div className="text-[10px] tracking-widest uppercase font-mono text-cyan-400 font-bold">
                ASTRA COSMOS • SPATIAL STAGE SCHEMATIC
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">{layout.title || 'Untitled Event Floorplan'}</h2>
              <p className="text-xs text-zinc-400 font-mono">{layout.venueName || 'Venue Layout Stage'}</p>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300 font-mono text-xs font-bold">
                {sheetRevision}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                DATE: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Key Technical Highlights Tally Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <LayersIcon className="w-3 h-3 text-indigo-400" /> Stage Decks
              </div>
              <div className="text-base font-black text-white font-mono mt-0.5">{totalStageDecks} Decks (4x8ft)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <RadioIcon className="w-3 h-3 text-cyan-400" /> LED Screen Area
              </div>
              <div className="text-base font-black text-white font-mono mt-0.5">{totalLedAreaSqMeters.toFixed(1)} m²</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <ZapIcon className="w-3 h-3 text-amber-400" /> Total Power Load
              </div>
              <div className="text-base font-black text-amber-300 font-mono mt-0.5">
                {(totalPowerWatts / 1000).toFixed(1)} kW / {((totalPowerWatts / 208) * 1.732).toFixed(0)}A
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase font-mono text-zinc-400 flex items-center justify-center gap-1">
                <UsersIcon className="w-3 h-3 text-emerald-400" /> Audience Capacity
              </div>
              <div className="text-base font-black text-emerald-300 font-mono mt-0.5">{totalSeats} Placed Seats</div>
            </div>
          </div>

          {/* Schematic Signal Legend */}
          <div className="bg-zinc-900/80 rounded-lg p-3 border border-zinc-800 mb-4">
            <div className="text-[10px] uppercase font-mono text-zinc-400 font-bold mb-2">Signal & Cable Run Standards</div>
            <div className="flex flex-wrap gap-4 text-xs font-mono">
              {Object.entries(SIGNAL_CONFIG).map(([key, item]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3.5 h-1.5 rounded-full" style={{ backgroundColor: item.hex }} />
                  <span className="text-zinc-300">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Sign-Off Block */}
          {includeSignoffs && (
            <div className="border border-cyan-500/30 bg-zinc-950/90 rounded-lg p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold mb-2">
                Production Department Approvals & Safety Sign-off
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-zinc-400">
                <div className="border-b border-zinc-800 pb-1">
                  <span className="text-zinc-500 block text-[9px]">AUDIO LEAD</span>
                  <span className="text-zinc-300">____________________</span>
                </div>
                <div className="border-b border-zinc-800 pb-1">
                  <span className="text-zinc-500 block text-[9px]">VIDEO & LED LEAD</span>
                  <span className="text-zinc-300">____________________</span>
                </div>
                <div className="border-b border-zinc-800 pb-1">
                  <span className="text-zinc-500 block text-[9px]">LIGHTING DESIGNER</span>
                  <span className="text-zinc-300">____________________</span>
                </div>
                <div className="border-b border-zinc-800 pb-1">
                  <span className="text-zinc-500 block text-[9px]">VENUE / SAFETY MARSHAL</span>
                  <span className="text-zinc-300">____________________</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Title Block */}
          <div className="mt-4 pt-3 border-t border-cyan-500/30 flex justify-between items-center text-[10px] font-mono text-zinc-500">
            <div>DRAFTED BY: {designerName} ({agencyName})</div>
            <div>CANVAS SIZE: {layout.roomWidth}m × {layout.roomHeight}m (SCALE 1:100)</div>
            <div>SHEET 01 OF 01</div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSignoffs}
                onChange={(e) => setIncludeSignoffs(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-cyan-500"
              />
              Include Sign-off Boxes
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs"
            >
              <PrinterIcon className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              Print / Save PDF
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadSvg}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg shadow-cyan-600/20"
            >
              <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
              Download Vector SVG
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
