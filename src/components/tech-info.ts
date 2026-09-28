export interface TechInfo {
  label: string;
  rank: number;
  cost: string;
}

const TECH_INFO: Record<string, TechInfo> = {
  'Pure CSS': {
    label: 'Lightest (CSS)',
    rank: 0,
    cost: 'Compositor only, safe on any phone',
  },
  'SVG filters': {
    label: 'SVG',
    rank: 1,
    cost: 'CPU filters, can be heavy on low-end phones',
  },
  Canvas: {
    label: 'Canvas',
    rank: 2,
    cost: 'Redraws every frame, moderate CPU',
  },
  'Shader (canvas)': {
    label: 'GPU shader',
    rank: 3,
    cost: 'Smooth on the GPU, uses more battery',
  },
  'WebGL (R3F + GLSL)': {
    label: '3D WebGL',
    rank: 4,
    cost: 'Heaviest, full 3D scene on the GPU',
  },
};

export const techInfo = (tech: string): TechInfo =>
  TECH_INFO[tech] ?? { label: tech, rank: Number.MAX_SAFE_INTEGER, cost: '' };

export const sortTechs = (techs: string[]): string[] =>
  [...techs].sort((a, b) => techInfo(a).rank - techInfo(b).rank);
