export const PILL_ORB_SCALE: Record<string, number> = {
  'pulse-orb': 1.7,
  'aurora-orb': 1.6,
  'dither-orb': 1.35,
  'gooey-orb': 0.9,
};

export const pillScaleFor = (id: string): number => PILL_ORB_SCALE[id] ?? 1;
