import Link from 'next/link';
import { orbs } from '@/registry/registry';
import { Gallery } from '@/components/gallery';
import { toGalleryOrb } from '@/components/gallery-orb';
import { ArrowRightIcon } from '@/components/orb-icons';

const Page = () => (
  <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
    <header className="mb-10 max-w-2xl sm:mb-14">
      <p className="mb-3 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">
        Open source · copy-paste
      </p>
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        Animated orbs for AI Assistants
      </h1>
      <p className="mt-4 text-pretty text-sm text-muted sm:text-base">
        A gallery of orbs with shared states:{' '}
        <span className="text-foreground">idle · connecting · listening · thinking · speaking</span>.
        Pick one to customize color, speed and size, then copy the code or an AI prompt.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="#gallery"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-accent bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Browse orbs
        </a>
        <Link
          href="/recipes"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-panel px-5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent-foreground"
        >
          Wire it to your stack
          <ArrowRightIcon />
        </Link>
      </div>
    </header>

    <Gallery orbs={orbs.map(toGalleryOrb)} />
  </main>
);

export default Page;
