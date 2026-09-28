import Link from 'next/link';
import { GitHubLink } from '@/components/github-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeaderNav } from '@/components/header-nav';

export const Header = () => (
  <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:px-5">
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground sm:gap-2.5"
      >
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-foreground))]"
        />
        <span className="truncate">VoiceOrbs</span>
      </Link>
      <div className="flex min-w-0 items-center gap-1 sm:gap-4">
        <HeaderNav />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <GitHubLink />
          <ThemeToggle />
        </div>
      </div>
    </div>
  </header>
);
