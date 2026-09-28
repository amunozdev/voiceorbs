import { orbs, ORB_PROPS } from '@/registry/registry';
import { ORB_STATES } from '@/registry/lib/orb-state';

export const dynamic = 'force-static';

const SITE_URL = 'https://voiceorbs.vercel.app';
const REPO_URL = 'https://github.com/amunozdev/voiceorbs';

export const GET = (): Response => {
  const coreStates = ORB_STATES.join(', ');
  const propLines = ORB_PROPS.map(
    (p) => `- \`${p.name}\` (\`${p.type}\`, default: ${p.default}): ${p.description}`,
  ).join('\n');
  const orbLines = orbs
    .map((orb) => `- [${orb.name}](${SITE_URL}/orbs/${orb.id}): ${orb.tech}. ${orb.tagline}`)
    .join('\n');

  const body = `# VoiceOrbs

> Animated, audio-reactive orbs for AI voice assistants: ${orbs.length} copy-paste React components sharing one small props contract, distributed as source code and AI prompts instead of an npm package.

VoiceOrbs is a gallery of animated orb components for React / Next.js voice interfaces. Every orb is a client component that visualizes the assistant lifecycle through a \`state\` prop and reacts to live audio through a \`levelRef\` without re-renders. Integration is copy-paste: grab the component files plus a small shared lib from the site or the repo, or copy a ready-made AI prompt (with provider wiring for Vapi, ElevenLabs, LiveKit and OpenAI Realtime) and let a coding agent do it.

## Props contract

All orbs accept the same props (\`OrbProps\` in \`src/registry/lib/orb-state.ts\`):

${propLines}

States: ${coreStates} form the core lifecycle; \`error\` and \`disabled\` are optional extensions implemented by every orb. Each orb also exposes the CSS variables \`--orb-size\`, \`--orb-speed\`, \`--orb-color-from\`, \`--orb-color-to\` and \`--orb-level\` for theming and animation from CSS.

## Orbs

${orbLines}

## Compact status pill

Every orb also works as a compact status indicator for tight spaces (chat headers, toolbars, inline agent steps). \`OrbPill\` (\`src/registry/lib/orb-pill.tsx\`) wraps any orb at a small size next to an animated feedback label: letters blur in on change, a light sweep runs while connecting or thinking, and the width eases between messages.

\`\`\`tsx
import { OrbPill } from '@/registry/lib/orb-pill';
import { SiriSheet } from '@/registry/orbe/siri-sheet/siri-sheet';

<OrbPill
  orb={SiriSheet}
  state="thinking"
  messages={{ thinking: ['Fetching prices', 'Running the numbers'] }}
/>
\`\`\`

- \`messages\`: per-state label, or an array of steps that rotate every \`interval\` ms (default 2600). Defaults: Ready, Connecting, Listening, Thinking, Speaking.
- \`text\`: fixed label that overrides \`messages\` (drive it from your own tool-call events).
- \`size\`: \`'sm' | 'md' | 'lg'\`; \`shimmer\`: \`'auto' | 'always' | 'never'\`; \`orbScale\`: enlarge orbs whose visual does not fill their box.
- Colors inherit \`currentColor\`; override with \`--orb-pill-bg\`, \`--orb-pill-border\`, \`--orb-pill-fg\`.

## Optional

- [GitHub repository](${REPO_URL}): full source, MIT licensed
- [Recipes](${SITE_URL}/recipes): wiring guides for a plain microphone, Vapi, ElevenLabs Agents, LiveKit Agents and OpenAI Realtime
- [Full source dump](${SITE_URL}/llms-full.txt): every orb plus the shared lib and an integration guide in one file
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
