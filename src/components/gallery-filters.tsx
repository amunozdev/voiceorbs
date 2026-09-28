'use client';

import clsx from 'clsx';
import { techInfo } from './tech-info';

const FilterChip = ({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={active}
    className={clsx(
      'inline-flex min-h-10 items-center rounded-full border px-3 text-xs transition-colors sm:min-h-8',
      active
        ? 'border-accent bg-accent/15 text-accent-foreground'
        : 'border-border text-muted hover:border-accent hover:text-foreground',
    )}
  >
    {label}
  </button>
);

export const GalleryFilters = ({
  query,
  onQueryChange,
  techOptions,
  activeTechs,
  onToggleTech,
  zeroDeps,
  onToggleZeroDeps,
  tailwind,
  onToggleTailwind,
  filtersActive,
  onClear,
  count,
  total,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  techOptions: string[];
  activeTechs: string[];
  onToggleTech: (tech: string) => void;
  zeroDeps: boolean;
  onToggleZeroDeps: () => void;
  tailwind: boolean;
  onToggleTailwind: () => void;
  filtersActive: boolean;
  onClear: () => void;
  count: number;
  total: number;
}) => (
  <div className="mb-8 flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="orb-search" className="sr-only">
        Search orbs
      </label>
      <input
        id="orb-search"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search orbs by name or tagline"
        className="min-h-10 w-full max-w-xs rounded-md border border-border bg-panel px-3 text-sm text-foreground transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <p role="status" className="text-xs text-muted tabular-nums">
        {count} of {total} orbs
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-accent-foreground underline-offset-4 transition-colors hover:underline sm:min-h-8"
        >
          Clear filters
        </button>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        role="group"
        aria-label="Rendering cost"
        aria-describedby="tech-filter-help"
        className="flex flex-wrap items-center gap-1.5"
      >
        {techOptions.map((tech) => (
          <FilterChip
            key={tech}
            label={techInfo(tech).label}
            active={activeTechs.includes(tech)}
            onToggle={() => onToggleTech(tech)}
          />
        ))}
      </div>
      <span aria-hidden="true" className="mx-0.5 hidden h-4 w-px bg-border sm:block" />
      <div role="group" aria-label="Setup" className="flex flex-wrap items-center gap-1.5">
        <FilterChip label="Zero deps" active={zeroDeps} onToggle={onToggleZeroDeps} />
        <FilterChip label="Tailwind variant" active={tailwind} onToggle={onToggleTailwind} />
      </div>
    </div>
    <p id="tech-filter-help" className="text-xs text-muted">
      Ordered lightest to heaviest. CSS orbs run on the compositor and are safe on any phone; GPU
      shaders and 3D WebGL look richest but cost more battery.
    </p>
  </div>
);
