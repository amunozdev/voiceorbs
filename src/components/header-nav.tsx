'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const LINKS = [
  { href: '/', label: 'Gallery', match: (path: string) => path === '/' || path.startsWith('/orbs') },
  { href: '/recipes', label: 'Recipes', match: (path: string) => path.startsWith('/recipes') },
];

export const HeaderNav = () => {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'inline-flex h-10 items-center rounded-md px-2.5 text-sm transition-colors sm:px-3',
              active
                ? 'bg-accent/15 font-medium text-accent-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
