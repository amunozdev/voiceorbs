import Link from 'next/link';
import { orbs } from '@/registry/registry';
import { Gallery } from '@/components/gallery';
import { toGalleryOrb } from '@/components/gallery-orb';
import { ArrowRightIcon } from '@/components/orb-icons';
import { HeroShowcase } from '@/components/hero-showcase';

const Page = () => (
  <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
    <header className="mb-10 grid items-center gap-4 sm:mb-16 sm:gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <div className="max-w-xl">
        <p className="mb-4 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">
          Open source React components
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-[1.02] tracking-tighter md:text-5xl lg:text-6xl">
          Animated orbs for AI assistants
        </h1>
        <p className="mt-5 max-w-[46ch] text-pretty text-base leading-relaxed text-muted">
          Copy-paste orbs that show what your voice agent is doing, from listening to thinking to speaking.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#gallery"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-accent bg-accent px-5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-accent/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.98]"
          >
            Browse orbs
          </a>
          <Link
            href="/recipes"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-panel px-5 text-sm font-medium text-foreground transition-[border-color,color,transform] hover:border-accent hover:text-accent-foreground active:scale-[0.98]"
          >
            Wire it to your stack
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
      <HeroShowcase />
    </header>

    <Gallery orbs={orbs.map(toGalleryOrb)} />
  </main>
);

export default Page;
