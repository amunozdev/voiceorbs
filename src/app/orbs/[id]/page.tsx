import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { orbs } from '@/registry/registry';
import { readAdapterFiles, readOrbFiles, readSharedFiles } from '@/registry/read-files';
import { OrbCard, type OrbCardData } from '@/components/orb-card';
import { CodePane } from '@/components/code-pane';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/orb-icons';
import { RecipeLinks } from '@/components/recipe-link';
import { techInfo } from '@/components/tech-info';
import { PropsTable } from './props-table';

export const dynamicParams = false;

export const generateStaticParams = () => orbs.map(({ id }) => ({ id }));

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const orb = orbs.find((o) => o.id === id);
  if (!orb) return {};
  const title = `${orb.name} | VoiceOrbs`;
  return {
    title,
    description: orb.tagline,
    alternates: { canonical: `/orbs/${orb.id}` },
    openGraph: {
      title,
      description: orb.tagline,
      url: `/orbs/${orb.id}`,
      siteName: 'VoiceOrbs',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: orb.tagline,
    },
  };
};

const wireSnippet = (component: string, id: string) => `'use client';
import { useState } from 'react';
import type { OrbState } from '@/registry/lib/orb-state';
import { useAudioLevel } from '@/registry/lib/use-audio-level';
import { ${component} } from '@/registry/orbe/${id}/${id}';

export const Assistant = () => {
  const [state, setState] = useState<OrbState>('idle');
  const { levelRef } = useAudioLevel(state === 'listening');

  return <${component} state={state} levelRef={levelRef} />;
};
`;

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const index = orbs.findIndex((o) => o.id === id);
  if (index === -1) notFound();

  const orb = orbs[index];
  const prevIndex = (index - 1 + orbs.length) % orbs.length;
  const nextIndex = (index + 1) % orbs.length;
  const prev = orbs[prevIndex];
  const next = orbs[nextIndex];
  const [files, shared, adapters] = await Promise.all([
    readOrbFiles(orb),
    readSharedFiles(),
    readAdapterFiles(),
  ]);

  const data: OrbCardData = {
    id: orb.id,
    name: orb.name,
    tagline: orb.tagline,
    tech: orb.tech,
    dependencies: orb.dependencies,
    defaultColorFrom: orb.defaultColorFrom,
    defaultColorTo: orb.defaultColorTo,
    defaultSize: orb.defaultSize,
    files,
  };

  const component = orb.name.replace(/\s+/g, '');
  const info = techInfo(orb.tech);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
        <Link
          href={`/#${orb.id}`}
          className="inline-flex min-h-10 items-center gap-1.5 transition-colors hover:text-accent-foreground"
        >
          <ArrowLeftIcon />
          All orbs
        </Link>
      </nav>

      <header className="mb-10 max-w-2xl">
        <p className="mb-3 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">
          {info.label}
          {orb.dependencies.length === 0 ? ' · zero deps' : ''}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">{orb.name}</h1>
        <p className="mt-4 text-pretty text-base text-muted">{orb.tagline}</p>
        {info.cost && <p className="mt-2 text-sm text-muted">Rendering cost: {info.cost.toLowerCase()}.</p>}
      </header>

      <section aria-label="Playground" className="mb-14">
        <OrbCard orb={data} shared={shared} adapters={adapters} hideHeader />
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Props</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Every orb implements the same contract, so they are interchangeable: swap the import and
          keep the props.
        </p>
        <PropsTable />
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Wire it to audio</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Drive <code className="font-mono text-xs text-foreground">state</code> from your assistant
          lifecycle and pass a{' '}
          <code className="font-mono text-xs text-foreground">levelRef</code> with the live
          amplitude. The bundled{' '}
          <code className="font-mono text-xs text-foreground">useAudioLevel</code> hook opens the
          microphone and writes a 0..1 level into the ref every frame without re-rendering; while
          the value is negative the orb falls back to its procedural animation.
        </p>
        <CodePane code={wireSnippet(component, orb.id)} />
        <p className="mt-6 mb-3 max-w-2xl text-sm text-muted">
          Using Vapi, ElevenLabs, LiveKit or OpenAI Realtime? The recipes map each provider to{' '}
          <code className="font-mono text-xs text-foreground">state</code> and{' '}
          <code className="font-mono text-xs text-foreground">levelRef</code>.
        </p>
        <RecipeLinks />
      </section>

      <nav aria-label="Orb navigation" className="border-t border-border pt-8">
        <p className="mb-4 text-center text-xs text-muted tabular-nums">
          <span className="sr-only">Orb </span>
          {index + 1} / {orbs.length}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/orbs/${prev.id}`}
            className="group rounded-2xl border border-border bg-panel/60 p-5 transition-colors hover:border-accent"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-muted tabular-nums">
              <ArrowLeftIcon />
              Previous · {prevIndex + 1} / {orbs.length}
            </span>
            <span className="mt-1 block font-semibold text-foreground transition-colors group-hover:text-accent-foreground">
              {prev.name}
            </span>
          </Link>
          <Link
            href={`/orbs/${next.id}`}
            className="group rounded-2xl border border-border bg-panel/60 p-5 text-right transition-colors hover:border-accent"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-muted tabular-nums">
              Next · {nextIndex + 1} / {orbs.length}
              <ArrowRightIcon />
            </span>
            <span className="mt-1 block font-semibold text-foreground transition-colors group-hover:text-accent-foreground">
              {next.name}
            </span>
          </Link>
        </div>
      </nav>
    </main>
  );
};

export default Page;
