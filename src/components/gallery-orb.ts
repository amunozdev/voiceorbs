import type { OrbMeta } from '@/registry/registry';

export interface GalleryOrb {
  id: string;
  name: string;
  tagline: string;
  tech: string;
  dependencies: string[];
  defaultColorFrom: string;
  defaultColorTo: string;
  defaultSize: number;
  hasTailwind: boolean;
}

export const toGalleryOrb = (orb: OrbMeta): GalleryOrb => ({
  id: orb.id,
  name: orb.name,
  tagline: orb.tagline,
  tech: orb.tech,
  dependencies: orb.dependencies,
  defaultColorFrom: orb.defaultColorFrom,
  defaultColorTo: orb.defaultColorTo,
  defaultSize: orb.defaultSize,
  hasTailwind: orb.files.some((file) => file.variant === 'tailwind'),
});
