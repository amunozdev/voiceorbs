# Orb distribution

This project is a **copy-paste gallery**: each orb lives in `src/registry/orbe/<orb>/` and is the
source of truth. There are two ways for a user to take an orb into their project.

## 1. Copy code

Each orb page (`/orbs/<id>`) has a **Get the code** group. **"View code"** opens a tab per file;
orbs that ship both styles show a **CSS Modules | Tailwind** switch first, so only one variant's
files appear. Every file has a copy button, and orbs with dependencies show a single install
command (npm, pnpm, yarn or bun; the choice is remembered). The user pastes the files and adds
the shared utilities from `src/registry/lib/` once: the full list is `SHARED_FILES` in
`src/registry/registry.ts` (state contract, animator, level and audio hooks, reduced motion,
color helpers, status live region and the `OrbPill` wrapper).

## 2. Copy AI prompt

A **"Copy AI prompt"** button per orb. It copies a self-contained prompt (shared utilities
+ orb files + props/state contract) optimized to paste into
Cursor / Copilot / Claude Code so the assistant recreates the orb and adapts it to the project.
The prompt is generated in `src/registry/prompt.ts` and follows the playground: the selected
styling variant, the current props and, under **More**, an optional provider adapter.

## 3. Compact status pill

The playground's **Orb | Pill** switch previews the orb inside `OrbPill`
(`src/registry/lib/orb-pill.tsx`), the small status indicator with an animated feedback label.
In Pill view the usage snippet and the AI prompt switch to `OrbPill`, including any custom
thinking steps typed in the playground.

## Shared contract (for customization)

Props: `state`, `size`, `speed`, `colorFrom`, `colorTo`, `levelRef`, `label`, `className`, `ref`.
Public CSS vars: `--orb-size`, `--orb-speed`, `--orb-color-from`, `--orb-color-to`,
`--orb-level`, `--orb-bass`, `--orb-mid`, `--orb-treble`.

- CSS-driven orbs (`pulse-orb`, `glass-orb`, `aurora-orb`, `halo-orb`, `equalizer-orb`, `minimal-orb`): Tailwind variant (`*-tw.tsx`) and CSS Module.
- Logic-driven orbs (Canvas, SVG filters, raw WebGL, paper shaders, R3F): JS/SVG/GLSL with
  `className` passthrough, a single implementation.
