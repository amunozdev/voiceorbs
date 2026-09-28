'use client';

import clsx from 'clsx';
import { isSamePreset, type GradientPreset } from './color-presets';

interface ColorPresetSwatchesProps {
  presets: GradientPreset[];
  colorFrom: string;
  colorTo: string;
  onSelect: (from: string, to: string) => void;
}

export const ColorPresetSwatches = ({
  presets,
  colorFrom,
  colorTo,
  onSelect,
}: ColorPresetSwatchesProps) => (
  <div role="group" aria-label="Color presets" className="flex flex-wrap items-center gap-1">
    {presets.map((preset) => {
      const active = isSamePreset(preset, colorFrom, colorTo);
      return (
        <button
          key={preset.name}
          type="button"
          onClick={() => onSelect(preset.from, preset.to)}
          aria-pressed={active}
          aria-label={preset.name}
          className="group grid size-10 shrink-0 place-items-center rounded-full sm:size-8"
        >
          <span
            aria-hidden="true"
            className={clsx(
              'size-7 rounded-full border transition-transform group-hover:scale-110 group-focus-visible:scale-110 sm:size-6',
              active ? 'border-accent ring-2 ring-accent/50' : 'border-border',
            )}
            style={{
              background: `linear-gradient(135deg in oklch, ${preset.from}, ${preset.to})`,
            }}
          />
        </button>
      );
    })}
  </div>
);
