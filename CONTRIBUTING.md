# Contributing to VoiceOrbs

Thanks for your interest in contributing! VoiceOrbs is an open-source, copy-paste gallery of animated orbs for conversational AI assistants. Contributions of all sizes are welcome: new orbs, bug fixes, docs, and accessibility improvements.

> Code, commit messages, and pull requests are written in **English**.

## Getting started

Requirements:

- **Node.js** 20 or newer
- **pnpm** 10 or newer (`corepack enable` will provide the pinned version)

Set up the project:

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000.

Useful scripts:

```bash
pnpm lint    # ESLint
pnpm test    # Vitest suite
pnpm build   # Production build
```

## Pull request flow

1. **Fork** the repository and clone your fork.
2. Create a **branch** from `main` (for example `feat/my-new-orb` or `fix/footer-contrast`).
3. Make your changes following the standards below.
4. Use **[Conventional Commits](https://www.conventionalcommits.org/)** for commit messages (e.g. `feat: add nebula orb`, `fix: correct footer contrast in light mode`).
5. Ensure `pnpm lint`, `pnpm test` and `pnpm build` are **green**.
6. Open a **pull request against `main`** with a clear description of what and why.

## Standards

- **TypeScript strict** mode everywhere.
- **Named exports** only (no default exports outside Next.js pages/config).
- `const` arrow functions for components; Server Components by default, add `"use client"` only when necessary.
- **kebab-case** file names; `import type` for type-only imports.
- Use the design tokens (`text-foreground`, `text-muted`, `border-border`, `text-accent-foreground`) and make sure UI works in **both dark and light themes**.
- Keep `pnpm lint`, `pnpm test` and `pnpm build` passing before you push.

## Adding an orb

1. Create `src/registry/orbe/<name>/<name>.tsx` (plus an optional `.module.css` and `-tw.tsx` Tailwind variant) exporting one component that accepts `OrbProps` from `src/registry/lib/orb-state.ts`.
2. Implement all seven states: `idle`, `connecting`, `listening`, `thinking`, `speaking`, `error` and `disabled`. Listening and speaking must look different (listening reacts to the user's voice, speaking to the agent's).
3. Blend between states, never switch. JS orbs use one loop from `useOrbAnimator` (`src/registry/lib/use-orb-animator.ts`) and describe each state as a table of numbers mixed with `blendStates`; CSS orbs register every per-state custom property with `@property` and transition it. Use the animator's accumulated `phase` for motion, never `time * speed`.
4. Read `levelRef` every frame without re-rendering; a negative value means no live audio.
5. Respect `prefers-reduced-motion`, cap the device pixel ratio at 2 and pause work while offscreen (the animator does both for you).
6. Register the orb in `src/registry/registry.ts` (start in `draftOrbs` to preview it at `/drafts`) and map its id in `src/components/orb-preview.tsx`.
7. Check it in both themes, in the home preview card (it shrinks into the status pill while thinking) and in the playground's Pill view.

## Issues

New here? Look for issues labeled **`good first issue`**; they are scoped to be approachable. Feel free to open an issue first to discuss larger changes before writing code.

## Environment variables

An optional `GITHUB_TOKEN` can be set (see `.env.example`) to raise GitHub API rate limits for the live star count. It is not required for local development.
