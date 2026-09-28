'use client';

import { useMemo, useState } from 'react';
import type { AdapterFilesWithCode, FileWithCode } from '@/registry/prompt';
import { OrbCard } from './orb-card';
import { OrbPreviewCard } from './orb-preview-card';
import { GalleryFilters } from './gallery-filters';
import { ComingSoonCard } from './coming-soon-card';
import { sortTechs } from './tech-info';
import type { GalleryOrb } from './gallery-orb';

export interface GalleryPlayground {
  files: Record<string, FileWithCode[]>;
  shared: FileWithCode[];
  adapters: AdapterFilesWithCode;
}

export const Gallery = ({
  orbs,
  playground,
}: {
  orbs: GalleryOrb[];
  playground?: GalleryPlayground;
}) => {
  const [query, setQuery] = useState('');
  const [activeTechs, setActiveTechs] = useState<string[]>([]);
  const [zeroDeps, setZeroDeps] = useState(false);
  const [tailwind, setTailwind] = useState(false);

  const techOptions = useMemo(() => sortTechs([...new Set(orbs.map((orb) => orb.tech))]), [orbs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orbs.filter((orb) => {
      if (q && !orb.name.toLowerCase().includes(q) && !orb.tagline.toLowerCase().includes(q)) {
        return false;
      }
      if (activeTechs.length > 0 && !activeTechs.includes(orb.tech)) return false;
      if (zeroDeps && orb.dependencies.length > 0) return false;
      if (tailwind && !orb.hasTailwind) return false;
      return true;
    });
  }, [orbs, query, activeTechs, zeroDeps, tailwind]);

  const toggleTech = (tech: string) =>
    setActiveTechs((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech],
    );

  const filtersActive =
    query.trim() !== '' || activeTechs.length > 0 || zeroDeps || tailwind;

  const clearFilters = () => {
    setQuery('');
    setActiveTechs([]);
    setZeroDeps(false);
    setTailwind(false);
  };

  return (
    <section id="gallery" aria-label="Orb gallery" className="scroll-mt-20">
      <GalleryFilters
        query={query}
        onQueryChange={setQuery}
        techOptions={techOptions}
        activeTechs={activeTechs}
        onToggleTech={toggleTech}
        zeroDeps={zeroDeps}
        onToggleZeroDeps={() => setZeroDeps((prev) => !prev)}
        tailwind={tailwind}
        onToggleTailwind={() => setTailwind((prev) => !prev)}
        filtersActive={filtersActive}
        onClear={clearFilters}
        count={filtered.length}
        total={orbs.length}
      />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-panel/60 p-10 text-center">
          <p className="text-sm text-muted">No orbs match the current search and filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-10 items-center rounded-md border border-accent bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/85"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {filtered.map((orb) =>
            playground ? (
              <OrbCard
                key={orb.id}
                orb={{ ...orb, files: playground.files[orb.id] ?? [] }}
                shared={playground.shared}
                adapters={playground.adapters}
              />
            ) : (
              <OrbPreviewCard key={orb.id} orb={orb} />
            ),
          )}
          {!filtersActive && !playground && <ComingSoonCard />}
        </div>
      )}
    </section>
  );
};
