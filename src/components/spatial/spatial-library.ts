/**
 * Spatial Stage & AV Floorplan Library Definitions
 * High-precision symbols, dimensions, power loads, and signal types for stage & venue production.
 */

export type SpatialCategory = 'staging' | 'av_broadcast' | 'audio_lighting' | 'power_signal' | 'seating_venue';

export type SignalType = 'power' | 'video' | 'audio' | 'lighting_dmx' | 'network';

export interface SpatialEquipmentDef {
  id: string;
  name: string;
  category: SpatialCategory;
  description: string;
  defaultWidth: number; // in meters (grid units: 1 unit = 1 meter = ~3.28 ft)
  defaultHeight: number; // in meters
  color: string;
  borderColor: string;
  shape: 'rect' | 'circle' | 'polygon' | 'desk' | 'camera' | 'speaker' | 'light_bar' | 'table_round' | 'seating_row' | 'drop_node';
  iconName?: string;
  defaultPowerDrawWatts?: number;
  tags: string[];
  points?: string; // For polygons
  metadata?: Record<string, any>;
}

export interface PlacedElement {
  id: string;
  defId: string;
  name: string;
  category: SpatialCategory;
  x: number; // in meters
  y: number; // in meters
  width: number;
  height: number;
  rotation: number; // in degrees (0 - 360)
  color?: string;
  borderColor?: string;
  shape: string;
  layer: number;
  locked?: boolean;
  notes?: string;
  customLabel?: string;
  powerDrawWatts?: number;
  signalType?: SignalType;
  fovAngle?: number; // for cameras (e.g. 60 deg)
  fovDistance?: number; // for cameras (e.g. 15 meters)
  seatCount?: number; // for seating
  metadata?: Record<string, any>;
}

export interface CableRun {
  id: string;
  name: string;
  signalType: SignalType;
  fromElementId: string;
  toElementId: string;
  fromPoint?: { x: number; y: number };
  toPoint?: { x: number; y: number };
  waypoints?: Array<{ x: number; y: number }>;
  lengthMeters?: number;
  color?: string;
  notes?: string;
}

export interface SpatialLayoutData {
  id: string;
  eventId?: string;
  title: string;
  venueName: string;
  date?: string;
  revision: string;
  roomWidth: number; // in meters (e.g. 40m)
  roomHeight: number; // in meters (e.g. 30m)
  unit: 'metric' | 'imperial';
  gridSize: number; // 0.5 or 1.0 meter
  elements: PlacedElement[];
  cables: CableRun[];
  notes?: string;
}

export const SIGNAL_CONFIG: Record<SignalType, { label: string; color: string; hex: string; strokeDash?: string }> = {
  power: { label: '3-Phase / AC Power', color: 'text-amber-400', hex: '#f59e0b' },
  video: { label: 'SDI / Fiber Video', color: 'text-cyan-400', hex: '#06b6d4' },
  audio: { label: 'Dante / XLR Audio', color: 'text-fuchsia-400', hex: '#d946ef' },
  lighting_dmx: { label: 'DMX / Art-Net', color: 'text-emerald-400', hex: '#10b981' },
  network: { label: 'Gigabit Network / Comms', color: 'text-blue-400', hex: '#3b82f6' },
};

export const EQUIPMENT_CATALOG: SpatialEquipmentDef[] = [
  // -------------------------------------------------------------
  // Staging & Structures
  // -------------------------------------------------------------
  {
    id: 'stage_deck_4x8',
    name: 'Stage Deck (4x8ft / 2.4x1.2m)',
    category: 'staging',
    description: 'Modular heavy-duty stage platform deck',
    defaultWidth: 2.44,
    defaultHeight: 1.22,
    color: '#1e293b',
    borderColor: '#475569',
    shape: 'rect',
    tags: ['deck', 'riser', 'platform', 'stage'],
  },
  {
    id: 'main_stage_proscenium',
    name: 'Main Stage (12x6m)',
    category: 'staging',
    description: 'Standard proscenium presentation stage platform',
    defaultWidth: 12.0,
    defaultHeight: 6.0,
    color: '#0f172a',
    borderColor: '#6366f1',
    shape: 'rect',
    tags: ['main', 'stage', 'proscenium', 'deck'],
  },
  {
    id: 'catwalk_thrust',
    name: 'Stage Runway / Thrust (2x6m)',
    category: 'staging',
    description: 'Catwalk runway extension into audience zone',
    defaultWidth: 2.0,
    defaultHeight: 6.0,
    color: '#1e1b4b',
    borderColor: '#818cf8',
    shape: 'rect',
    tags: ['catwalk', 'thrust', 'runway'],
  },
  {
    id: 'drum_riser',
    name: 'Drum / Band Riser (2.4x2.4m)',
    category: 'staging',
    description: 'Elevated backline performance riser',
    defaultWidth: 2.44,
    defaultHeight: 2.44,
    color: '#312e81',
    borderColor: '#a5b4fc',
    shape: 'rect',
    tags: ['drum', 'riser', 'band', 'backline'],
  },
  {
    id: 'podium_lectern',
    name: 'Keynote Podium / Lectern',
    category: 'staging',
    description: 'Keynote presentation lectern with mic mounts',
    defaultWidth: 0.9,
    defaultHeight: 0.6,
    color: '#374151',
    borderColor: '#9ca3af',
    shape: 'rect',
    tags: ['podium', 'lectern', 'speaker', 'mic'],
  },
  {
    id: 'box_truss_straight',
    name: '12" Box Truss (4m section)',
    category: 'staging',
    description: 'Rigging box truss section for lights/speakers',
    defaultWidth: 4.0,
    defaultHeight: 0.35,
    color: '#475569',
    borderColor: '#94a3b8',
    shape: 'rect',
    tags: ['truss', 'rigging', 'lighting', 'grid'],
  },
  {
    id: 'ground_support_tower',
    name: 'Truss Ground Support Tower',
    category: 'staging',
    description: 'Vertical heavy-base truss tower with outriggers',
    defaultWidth: 1.2,
    defaultHeight: 1.2,
    color: '#334155',
    borderColor: '#cbd5e1',
    shape: 'rect',
    tags: ['tower', 'truss', 'ground support'],
  },

  // -------------------------------------------------------------
  // AV & Broadcast
  // -------------------------------------------------------------
  {
    id: 'led_wall_main',
    name: 'Main LED Video Wall (10x4m)',
    category: 'av_broadcast',
    description: 'High-res 2.6mm pitch LED backdrop screen (3840x1536 px)',
    defaultWidth: 10.0,
    defaultHeight: 0.5,
    color: '#0284c7',
    borderColor: '#38bdf8',
    shape: 'rect',
    defaultPowerDrawWatts: 4500,
    tags: ['led', 'screen', 'video', 'backdrop', 'wall'],
    metadata: { resolution: '3840 x 1536', pitch: '2.6mm', nits: 1200 },
  },
  {
    id: 'imag_screen_side',
    name: 'Side IMAG LED Wall (4x2.5m)',
    category: 'av_broadcast',
    description: 'Left/Right side audience projection/LED screen',
    defaultWidth: 4.0,
    defaultHeight: 0.4,
    color: '#0369a1',
    borderColor: '#7dd3fc',
    shape: 'rect',
    defaultPowerDrawWatts: 1800,
    tags: ['imag', 'screen', 'side', 'projection'],
  },
  {
    id: 'foh_production_desk',
    name: 'FOH Command Console (6x2.5m)',
    category: 'av_broadcast',
    description: 'Front of House Audio, Video Switcher & Lighting Desk',
    defaultWidth: 6.0,
    defaultHeight: 2.5,
    color: '#18181b',
    borderColor: '#a855f7',
    shape: 'desk',
    defaultPowerDrawWatts: 3200,
    tags: ['foh', 'audio desk', 'video switcher', 'lighting console', 'control'],
  },
  {
    id: 'broadcast_cam_tripod',
    name: 'Broadcast Camera 1 (Center Sticks)',
    category: 'av_broadcast',
    description: 'Pedestal / heavy tripod broadcast camera with 60° FOV',
    defaultWidth: 1.2,
    defaultHeight: 1.2,
    color: '#0f766e',
    borderColor: '#2dd4bf',
    shape: 'camera',
    defaultPowerDrawWatts: 250,
    tags: ['camera', 'broadcast', 'video', 'cam1', 'foh'],
    metadata: { fovAngle: 55, fovDistance: 18 },
  },
  {
    id: 'jib_crane_cam',
    name: 'Jib / Crane Camera (24ft Arm)',
    category: 'av_broadcast',
    description: 'Articulated jib crane with sweeping wide lens',
    defaultWidth: 3.5,
    defaultHeight: 3.5,
    color: '#115e59',
    borderColor: '#5eead4',
    shape: 'camera',
    defaultPowerDrawWatts: 400,
    tags: ['jib', 'crane', 'camera', 'arm'],
    metadata: { fovAngle: 85, fovDistance: 12 },
  },
  {
    id: 'ptz_robotic_cam',
    name: 'PTZ Robotic Camera',
    category: 'av_broadcast',
    description: 'Compact 4K robotic pan-tilt-zoom camera on truss',
    defaultWidth: 0.6,
    defaultHeight: 0.6,
    color: '#134e4a',
    borderColor: '#99f6e4',
    shape: 'camera',
    defaultPowerDrawWatts: 60,
    tags: ['ptz', 'remote', 'camera'],
    metadata: { fovAngle: 65, fovDistance: 10 },
  },
  {
    id: 'confidence_monitor_wedge',
    name: 'Confidence Monitor / DSM (55")',
    category: 'av_broadcast',
    description: 'Downstage presenter confidence monitor for slides/notes',
    defaultWidth: 1.3,
    defaultHeight: 0.5,
    color: '#1e293b',
    borderColor: '#38bdf8',
    shape: 'rect',
    defaultPowerDrawWatts: 150,
    tags: ['dsm', 'confidence', 'monitor', 'teleprompter', 'downstage'],
  },

  // -------------------------------------------------------------
  // Audio & Lighting
  // -------------------------------------------------------------
  {
    id: 'pa_line_array_tower',
    name: 'PA Line Array Tower (L/R)',
    category: 'audio_lighting',
    description: 'Flown / ground-stacked line array speaker cluster',
    defaultWidth: 1.2,
    defaultHeight: 1.2,
    color: '#831843',
    borderColor: '#f43f5e',
    shape: 'speaker',
    defaultPowerDrawWatts: 5000,
    tags: ['pa', 'audio', 'speaker', 'line array', 'sound'],
  },
  {
    id: 'subwoofer_cluster',
    name: 'Subwoofer Array (Dual 18")',
    category: 'audio_lighting',
    description: 'Front stage low-frequency subwoofer block',
    defaultWidth: 2.0,
    defaultHeight: 0.8,
    color: '#701a75',
    borderColor: '#d946ef',
    shape: 'speaker',
    defaultPowerDrawWatts: 3000,
    tags: ['sub', 'subwoofer', 'bass', 'audio'],
  },
  {
    id: 'stage_monitor_wedge',
    name: 'Stage Audio Wedge (Foldback)',
    category: 'audio_lighting',
    description: '12" floor wedge monitor for talent audio mix',
    defaultWidth: 0.6,
    defaultHeight: 0.5,
    color: '#4a044e',
    borderColor: '#f0abfc',
    shape: 'speaker',
    defaultPowerDrawWatts: 600,
    tags: ['wedge', 'foldback', 'monitor', 'audio'],
  },
  {
    id: 'moving_head_fixture',
    name: 'Moving Head Beam / Spot',
    category: 'audio_lighting',
    description: 'Intelligent DMX moving light on truss/stage deck',
    defaultWidth: 0.5,
    defaultHeight: 0.5,
    color: '#065f46',
    borderColor: '#34d399',
    shape: 'circle',
    defaultPowerDrawWatts: 450,
    tags: ['light', 'mover', 'dmx', 'spot', 'beam'],
  },
  {
    id: 'led_wash_bar',
    name: 'LED Wash / Strobe Bar (1m)',
    category: 'audio_lighting',
    description: 'Linear stage cyc / backdrop wash bar',
    defaultWidth: 1.0,
    defaultHeight: 0.2,
    color: '#047857',
    borderColor: '#6ee7b7',
    shape: 'light_bar',
    defaultPowerDrawWatts: 200,
    tags: ['wash', 'led', 'strobe', 'cyc', 'light'],
  },

  // -------------------------------------------------------------
  // Power & Signal Drops
  // -------------------------------------------------------------
  {
    id: 'power_drop_3phase_400a',
    name: '3-Phase 400A Power Distro Drop',
    category: 'power_signal',
    description: 'Primary high-amperage venue power connection box',
    defaultWidth: 1.0,
    defaultHeight: 1.0,
    color: '#78350f',
    borderColor: '#f59e0b',
    shape: 'drop_node',
    tags: ['power', '3phase', 'distro', 'camlock', '400a'],
    metadata: { maxAmps: 400, voltage: '208V 3-Phase', signalType: 'power' },
  },
  {
    id: 'power_drop_edison_20a',
    name: '20A Edison Quad Box Drop',
    category: 'power_signal',
    description: 'Single-phase 120V convenience power quad box',
    defaultWidth: 0.5,
    defaultHeight: 0.5,
    color: '#92400e',
    borderColor: '#fbbf24',
    shape: 'drop_node',
    tags: ['power', 'edison', 'quad', '120v', '20a'],
    metadata: { maxAmps: 20, voltage: '120V', signalType: 'power' },
  },
  {
    id: 'video_sdi_fiber_patch',
    name: 'Video SDI / Optical Fiber Patch',
    category: 'power_signal',
    description: '12G-SDI / SMPTE optical video trunk line patch',
    defaultWidth: 0.8,
    defaultHeight: 0.8,
    color: '#155e75',
    borderColor: '#22d3ee',
    shape: 'drop_node',
    tags: ['video', 'sdi', 'fiber', 'patch', 'trunk'],
    metadata: { signalType: 'video' },
  },
  {
    id: 'audio_dante_snake_drop',
    name: 'Dante / XLR Stage Box (32-in/16-out)',
    category: 'power_signal',
    description: 'Digital audio stage snake breakout box',
    defaultWidth: 0.8,
    defaultHeight: 0.8,
    color: '#86198f',
    borderColor: '#e879f9',
    shape: 'drop_node',
    tags: ['audio', 'dante', 'snake', 'xlr', 'stagebox'],
    metadata: { signalType: 'audio' },
  },
  {
    id: 'intercom_comms_station',
    name: 'Wireless Intercom Base & Beltpack Drop',
    category: 'power_signal',
    description: 'Production crew comms antenna / base station',
    defaultWidth: 0.6,
    defaultHeight: 0.6,
    color: '#1e40af',
    borderColor: '#60a5fa',
    shape: 'drop_node',
    tags: ['comms', 'intercom', 'clearcom', 'bolero', 'headset'],
    metadata: { signalType: 'network' },
  },

  // -------------------------------------------------------------
  // Venue Architecture & Seating
  // -------------------------------------------------------------
  {
    id: 'banquet_table_round_8',
    name: 'Round Banquet Table (8-Seat)',
    category: 'seating_venue',
    description: '6ft (1.8m) diameter round dining / gala table with 8 chairs',
    defaultWidth: 2.2,
    defaultHeight: 2.2,
    color: '#334155',
    borderColor: '#94a3b8',
    shape: 'table_round',
    tags: ['banquet', 'table', 'round', 'gala', 'chairs', 'seating'],
    metadata: { seatCount: 8 },
  },
  {
    id: 'theater_seating_block_10',
    name: 'Theater Seating Row (10 Chairs)',
    category: 'seating_venue',
    description: 'Audience banquet / conference chair row',
    defaultWidth: 5.5,
    defaultHeight: 0.8,
    color: '#1e293b',
    borderColor: '#64748b',
    shape: 'seating_row',
    tags: ['theater', 'chairs', 'row', 'audience', 'keynote'],
    metadata: { seatCount: 10 },
  },
  {
    id: 'pipe_and_drape_curtain',
    name: 'Pipe & Drape / Velvet Curtain (6m)',
    category: 'seating_venue',
    description: 'Blackout perimeter / backstage masking curtain line',
    defaultWidth: 6.0,
    defaultHeight: 0.3,
    color: '#18181b',
    borderColor: '#52525b',
    shape: 'rect',
    tags: ['curtain', 'drape', 'pipe and drape', 'masking', 'blackout'],
  },
  {
    id: 'fire_exit_door',
    name: 'Venue Fire Exit / Egress Clearance',
    category: 'seating_venue',
    description: 'Required 2m clear path emergency exit doorway',
    defaultWidth: 2.0,
    defaultHeight: 1.0,
    color: '#7f1d1d',
    borderColor: '#ef4444',
    shape: 'rect',
    tags: ['fire', 'exit', 'egress', 'safety', 'door'],
  },
];

// -------------------------------------------------------------
// Pre-configured Venue / Stage Layout Templates
// -------------------------------------------------------------
export const VENUE_TEMPLATES: Array<{ id: string; name: string; description: string; data: Partial<SpatialLayoutData> }> = [
  {
    id: 'keynote_ballroom_a',
    name: 'Corporate Keynote (Grand Ballroom A)',
    description: '12x6m Stage, 10m LED Backdrop, 2 IMAGs, FOH Control Desk, 2 Cameras & VIP Round Tables',
    data: {
      title: 'Global Summit 2026 - Main Ballroom',
      venueName: 'Metropolitan Convention Center - Grand Ballroom A',
      revision: 'Rev 1.0',
      roomWidth: 36,
      roomHeight: 24,
      unit: 'metric',
      gridSize: 1.0,
      elements: [
        // Main Stage
        {
          id: 'elem_stage_main',
          defId: 'main_stage_proscenium',
          name: 'Main Presentation Stage',
          category: 'staging',
          x: 12,
          y: 2,
          width: 12,
          height: 6,
          rotation: 0,
          color: '#0f172a',
          shape: 'rect',
          layer: 1,
        },
        // Main LED Wall
        {
          id: 'elem_led_main',
          defId: 'led_wall_main',
          name: 'Main LED Backdrop (3840x1536)',
          category: 'av_broadcast',
          x: 13,
          y: 2.2,
          width: 10,
          height: 0.5,
          rotation: 0,
          color: '#0284c7',
          shape: 'rect',
          layer: 2,
          powerDrawWatts: 4500,
        },
        // Left IMAG
        {
          id: 'elem_imag_left',
          defId: 'imag_screen_side',
          name: 'Left IMAG Screen',
          category: 'av_broadcast',
          x: 7,
          y: 3,
          width: 4,
          height: 0.4,
          rotation: 15,
          color: '#0369a1',
          shape: 'rect',
          layer: 2,
          powerDrawWatts: 1800,
        },
        // Right IMAG
        {
          id: 'elem_imag_right',
          defId: 'imag_screen_side',
          name: 'Right IMAG Screen',
          category: 'av_broadcast',
          x: 25,
          y: 3,
          width: 4,
          height: 0.4,
          rotation: -15,
          color: '#0369a1',
          shape: 'rect',
          layer: 2,
          powerDrawWatts: 1800,
        },
        // Podium
        {
          id: 'elem_podium',
          defId: 'podium_lectern',
          name: 'Speaker Podium',
          category: 'staging',
          x: 14,
          y: 6.5,
          width: 0.9,
          height: 0.6,
          rotation: 0,
          color: '#374151',
          shape: 'rect',
          layer: 3,
        },
        // PA Left
        {
          id: 'elem_pa_left',
          defId: 'pa_line_array_tower',
          name: 'Left PA Tower',
          category: 'audio_lighting',
          x: 11.5,
          y: 7.5,
          width: 1.2,
          height: 1.2,
          rotation: 0,
          color: '#831843',
          shape: 'speaker',
          layer: 3,
          powerDrawWatts: 5000,
        },
        // PA Right
        {
          id: 'elem_pa_right',
          defId: 'pa_line_array_tower',
          name: 'Right PA Tower',
          category: 'audio_lighting',
          x: 23.3,
          y: 7.5,
          width: 1.2,
          height: 1.2,
          rotation: 0,
          color: '#831843',
          shape: 'speaker',
          layer: 3,
          powerDrawWatts: 5000,
        },
        // FOH Production Desk
        {
          id: 'elem_foh_desk',
          defId: 'foh_production_desk',
          name: 'FOH Audio & Video Desk',
          category: 'av_broadcast',
          x: 15,
          y: 18,
          width: 6,
          height: 2.5,
          rotation: 0,
          color: '#18181b',
          shape: 'desk',
          layer: 2,
          powerDrawWatts: 3200,
        },
        // Camera 1 Center
        {
          id: 'elem_cam_1',
          defId: 'broadcast_cam_tripod',
          name: 'Cam 1 (Center Sticks)',
          category: 'av_broadcast',
          x: 17.4,
          y: 16.5,
          width: 1.2,
          height: 1.2,
          rotation: 0,
          color: '#0f766e',
          shape: 'camera',
          layer: 3,
          powerDrawWatts: 250,
          fovAngle: 50,
          fovDistance: 14,
        },
        // 3-Phase Power Drop (Stage Left)
        {
          id: 'elem_power_main',
          defId: 'power_drop_3phase_400a',
          name: '400A Stage Power Drop',
          category: 'power_signal',
          x: 3,
          y: 2,
          width: 1.0,
          height: 1.0,
          rotation: 0,
          color: '#78350f',
          shape: 'drop_node',
          layer: 2,
          signalType: 'power',
        },
        // Audio Dante Snake (Stage Right)
        {
          id: 'elem_audio_snake',
          defId: 'audio_dante_snake_drop',
          name: 'Dante Stage Snake',
          category: 'power_signal',
          x: 23,
          y: 2.5,
          width: 0.8,
          height: 0.8,
          rotation: 0,
          color: '#86198f',
          shape: 'drop_node',
          layer: 2,
          signalType: 'audio',
        },
        // Seating Row 1
        {
          id: 'elem_seat_row_1',
          defId: 'theater_seating_block_10',
          name: 'Audience Row A (Center)',
          category: 'seating_venue',
          x: 15.2,
          y: 10.5,
          width: 5.5,
          height: 0.8,
          rotation: 0,
          color: '#1e293b',
          shape: 'seating_row',
          layer: 1,
          seatCount: 10,
        },
        // Seating Row 2
        {
          id: 'elem_seat_row_2',
          defId: 'theater_seating_block_10',
          name: 'Audience Row B (Center)',
          category: 'seating_venue',
          x: 15.2,
          y: 12.0,
          width: 5.5,
          height: 0.8,
          rotation: 0,
          color: '#1e293b',
          shape: 'seating_row',
          layer: 1,
          seatCount: 10,
        },
        // Seating Row 3
        {
          id: 'elem_seat_row_3',
          defId: 'theater_seating_block_10',
          name: 'Audience Row C (Center)',
          category: 'seating_venue',
          x: 15.2,
          y: 13.5,
          width: 5.5,
          height: 0.8,
          rotation: 0,
          color: '#1e293b',
          shape: 'seating_row',
          layer: 1,
          seatCount: 10,
        },
      ],
      cables: [
        {
          id: 'cable_power_1',
          name: 'Stage Power Trunk',
          signalType: 'power',
          fromElementId: 'elem_power_main',
          toElementId: 'elem_led_main',
          lengthMeters: 12,
        },
        {
          id: 'cable_audio_1',
          name: 'Dante Primary to FOH',
          signalType: 'audio',
          fromElementId: 'elem_audio_snake',
          toElementId: 'elem_foh_desk',
          lengthMeters: 22,
        },
        {
          id: 'cable_video_1',
          name: 'Cam 1 12G-SDI to FOH Switcher',
          signalType: 'video',
          fromElementId: 'elem_cam_1',
          toElementId: 'elem_foh_desk',
          lengthMeters: 8,
        },
      ],
    },
  },
  {
    id: 'thrust_fashion_show',
    name: 'Fashion / Product Runway Stage',
    description: 'Catwalk runway extending into audience, dual side seating, high-intensity wash lighting & FOH',
    data: {
      title: 'Runway & Product Showcase',
      venueName: 'Center Stage Pavillion',
      revision: 'Rev 1.0',
      roomWidth: 30,
      roomHeight: 20,
      unit: 'metric',
      gridSize: 1.0,
      elements: [
        {
          id: 'elem_stage_base',
          defId: 'main_stage_proscenium',
          name: 'Back Stage Area',
          category: 'staging',
          x: 9,
          y: 2,
          width: 12,
          height: 4,
          rotation: 0,
          color: '#0f172a',
          shape: 'rect',
          layer: 1,
        },
        {
          id: 'elem_catwalk',
          defId: 'catwalk_thrust',
          name: 'Main Runway Catwalk',
          category: 'staging',
          x: 14,
          y: 6,
          width: 2,
          height: 8,
          rotation: 0,
          color: '#1e1b4b',
          shape: 'rect',
          layer: 2,
        },
      ],
      cables: [],
    },
  },
];
