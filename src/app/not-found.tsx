import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/orb-icons';

export const metadata: Metadata = {
  title: 'Page not found | VoiceOrbs',
};

const NotFound = () => (
  <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-5">
    <span
      aria-hidden="true"
      className="mb-8 size-24 rounded-full bg-[radial-gradient(circle_at_36%_30%,var(--color-accent-foreground),var(--color-accent)_62%,transparent_100%)] opacity-60"
    />
    <p className="text-xs font-medium tracking-widest text-muted uppercase">404</p>
    <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
      This orb drifted away
    </h1>
    <p className="mt-4 max-w-md text-pretty text-sm text-muted sm:text-base">
      The page you are looking for does not exist or has moved.
    </p>
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-accent bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent/85"
      >
        <ArrowLeftIcon />
        Back to the gallery
      </Link>
      <Link
        href="/recipes"
        className="inline-flex min-h-11 items-center rounded-md border border-border bg-panel px-5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent-foreground"
      >
        Integration recipes
      </Link>
    </div>
  </main>
);

export default NotFound;
