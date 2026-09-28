'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import { ORB_STATES, type OrbState } from '@/registry/lib/orb-state';
import { OrbStatus } from '@/registry/lib/orb-status';
import { useAudioLevel } from '@/registry/lib/use-audio-level';
import { useOrbCues } from '@/registry/lib/use-orb-cues';
import {
  buildAiPrompt,
  buildPillSnippet,
  buildUsageSnippet,
  type AdapterFilesWithCode,
  type FileWithCode,
  type PromptProvider,
} from '@/registry/prompt';
import { OrbPill, type OrbPillSize } from '@/registry/lib/orb-pill';
import { OrbPreview, orbComponent } from './orb-preview';
import { pillScaleFor } from './pill-scale';
import { CodeBlock } from './code-block';
import { CopyButton } from './copy-button';
import { ColorField } from './color-field';
import { ColorPresetSwatches } from './color-preset-swatches';
import { findPreset, presetsForOrb } from './color-presets';
import { SegmentedControl } from './segmented-control';
import { SPEED_PRESETS, sizePresetsForOrb } from './control-presets';
import { InstallBlock } from './install-block';
import { OpenInStackblitz } from './open-in-stackblitz';
import { Disclosure } from './disclosure';
import { PlayIcon, PauseIcon, MicIcon, MicOffIcon, SoundIcon, SoundOffIcon } from './orb-icons';
import { Select } from './select';
import { PROVIDERS, PROVIDER_STORAGE_KEY, PROVIDER_VALUES } from './providers';
import { useDemoCycle } from './use-demo-cycle';
import { useStoredChoice } from './use-stored-choice';

export interface OrbCardData {
  id: string;
  name: string;
  tagline: string;
  tech: string;
  dependencies: string[];
  defaultColorFrom: string;
  defaultColorTo: string;
  defaultSize: number;
  files: FileWithCode[];
}

type StyleVariant = 'css-modules' | 'tailwind';

const SPECIAL_STATES = ['error', 'disabled'] as const satisfies readonly OrbState[];

const MIC_ERROR_LABEL = {
  'permission-denied': 'Mic blocked',
  unavailable: 'Mic unavailable',
} as const;

const MIC_ERROR_TEXT = {
  'permission-denied': 'Microphone permission was denied. Allow mic access in the browser and try again.',
  unavailable: 'Microphone is unavailable in this browser or context (use localhost or https).',
} as const;

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Error',
  disabled: 'Disabled',
};

const VARIANT_OPTIONS: { value: StyleVariant; label: string }[] = [
  { value: 'css-modules', label: 'CSS Modules' },
  { value: 'tailwind', label: 'Tailwind' },
];

const DEFAULT_SPEED = 1;

const pillButton = (active: boolean) =>
  clsx(
    'inline-flex min-h-10 items-center justify-center rounded px-3 text-xs font-medium transition-colors sm:min-h-7 sm:px-2.5',
    active ? 'bg-accent/15 text-accent-foreground' : 'text-muted hover:text-foreground',
  );

const transportChip = (active: boolean) =>
  clsx(
    'inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:min-h-8',
    active
      ? 'border-accent bg-accent/15 text-accent-foreground'
      : 'border-border bg-panel text-muted hover:text-foreground',
  );

const SECONDARY_BUTTON =
  'inline-flex min-h-10 items-center rounded-md border border-border bg-panel px-3 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent-foreground sm:min-h-8';

const PILL_GROUP = 'flex w-fit flex-wrap items-center gap-0.5 rounded-md border border-border bg-panel p-0.5';

const Group = ({
  title,
  action,
  children,
  className,
  level = 'h3',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  level?: 'h2' | 'h3';
}) => {
  const id = useId();
  const Heading = level;
  return (
    <section aria-labelledby={id} className={clsx('flex flex-col gap-4', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <Heading id={id} className="text-sm font-semibold text-foreground">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
};

const Field = ({ label, value, children }: { label: string; value?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5 text-xs">
    <span className="text-muted">
      {label}
      {value && <span className="text-foreground"> · {value}</span>}
    </span>
    {children}
  </div>
);

const tailwindComponentName = (file: FileWithCode | undefined, fallback: string): string =>
  file?.code.match(/export const (\w+)/)?.[1] ?? fallback;

const importPathOf = (file: FileWithCode): string =>
  `@/${file.path.replace(/^src\//, '').replace(/\.tsx?$/, '')}`;

type PreviewView = 'orb' | 'pill';

const PREVIEW_VIEWS: { value: PreviewView; label: string }[] = [
  { value: 'orb', label: 'Orb' },
  { value: 'pill', label: 'Pill' },
];

const PILL_SIZES: OrbPillSize[] = ['sm', 'md', 'lg'];

const EXAMPLE_STEPS = 'Fetching prices, Running the numbers, Checking the database, Researching';

export const OrbCard = ({
  orb,
  shared,
  adapters,
  hideHeader = false,
}: {
  orb: OrbCardData;
  shared: FileWithCode[];
  adapters: AdapterFilesWithCode;
  hideHeader?: boolean;
}) => {
  const [state, setState] = useState<OrbState>('idle');
  const [mic, setMic] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [size, setSize] = useState(orb.defaultSize);
  const [colorFrom, setColorFrom] = useState(orb.defaultColorFrom);
  const [colorTo, setColorTo] = useState(orb.defaultColorTo);
  const [showCode, setShowCode] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [cues, setCues] = useState(false);
  const [variant, setVariant] = useState<StyleVariant>('css-modules');
  const [view, setView] = useState<PreviewView>('orb');
  const [stepsText, setStepsText] = useState('');
  const [provider, setProvider] = useStoredChoice<PromptProvider>(
    PROVIDER_STORAGE_KEY,
    PROVIDER_VALUES,
    'generic',
  );
  const { levelRef, error: micError } = useAudioLevel(mic);
  const [seenMicError, setSeenMicError] = useState<typeof micError>(null);
  const demo = useDemoCycle(setState);
  const transportHelpId = useId();
  const stepsHelpId = useId();
  const groupLevel = hideHeader ? 'h2' : 'h3';

  useOrbCues(state, { enabled: cues });

  if (micError !== seenMicError) {
    setSeenMicError(micError);
    if (micError) setMic(false);
  }

  const hasTailwind = useMemo(() => orb.files.some((file) => file.variant === 'tailwind'), [orb.files]);
  const activeVariant: StyleVariant = hasTailwind ? variant : 'css-modules';

  const variantFiles = useMemo(
    () =>
      hasTailwind
        ? orb.files.filter((file) => !file.variant || file.variant === activeVariant)
        : orb.files,
    [orb.files, hasTailwind, activeVariant],
  );

  const cssModuleFiles = useMemo(
    () => orb.files.filter((file) => file.variant !== 'tailwind'),
    [orb.files],
  );

  const baseComponent = orb.name.replace(/\s+/g, '');
  const tailwindFile = activeVariant === 'tailwind' ? variantFiles.find((f) => f.lang === 'tsx') : undefined;
  const component = tailwindFile ? tailwindComponentName(tailwindFile, baseComponent) : baseComponent;
  const importPath = tailwindFile ? importPathOf(tailwindFile) : undefined;

  const steps = useMemo(
    () =>
      stepsText
        .split(',')
        .map((step) => step.trim())
        .filter(Boolean),
    [stepsText],
  );

  const usageFile = useMemo<FileWithCode>(
    () => ({
      label: 'Usage',
      path: 'usage.tsx',
      lang: 'tsx',
      code:
        view === 'pill'
          ? buildPillSnippet(component, { state, size, speed, colorFrom, colorTo }, steps, importPath, pillScaleFor(orb.id))
          : buildUsageSnippet(component, { state, size, speed, colorFrom, colorTo }, importPath),
    }),
    [view, component, importPath, state, size, speed, colorFrom, colorTo, steps, orb.id],
  );

  const codeFiles = useMemo(() => [usageFile, ...variantFiles], [usageFile, variantFiles]);

  const aiPrompt = useMemo(
    () =>
      `${buildAiPrompt(
        orb.name,
        orb.dependencies,
        variantFiles,
        shared,
        provider,
        provider === 'generic' ? undefined : adapters[provider],
        component,
      )}

Requested configuration (current playground values, render the orb with exactly these props):
\`\`\`tsx
${usageFile.code}\`\`\``,
    [orb.name, orb.dependencies, variantFiles, shared, provider, adapters, component, usageFile.code],
  );

  const reactive = state === 'listening' || state === 'speaking';
  const reactiveRef = useRef(reactive);

  useEffect(() => {
    reactiveRef.current = reactive;
  }, [reactive]);

  const stageLevelRef = useMemo<RefObject<number>>(
    () => ({
      get current() {
        return reactiveRef.current ? levelRef.current : -1;
      },
    }),
    [levelRef],
  );

  const selectState = (next: OrbState) => {
    demo.stop();
    setState(next);
  };

  const toggleMic = () => {
    setMic((prev) => {
      const next = !prev;
      if (next) {
        demo.stop();
        if (state === 'idle' || state === 'connecting') setState('listening');
      }
      return next;
    });
  };

  const presets = useMemo(() => presetsForOrb(orb.id), [orb.id]);
  const sizePresets = useMemo(() => sizePresetsForOrb(orb.defaultSize), [orb.defaultSize]);
  const activePreset = findPreset(presets, colorFrom, colorTo);
  const isDefaultColor =
    colorFrom.toLowerCase() === orb.defaultColorFrom.toLowerCase() &&
    colorTo.toLowerCase() === orb.defaultColorTo.toLowerCase();
  const colorName = activePreset?.name ?? (isDefaultColor ? 'Default' : 'Custom');
  const pristine = isDefaultColor && size === orb.defaultSize && speed === DEFAULT_SPEED;
  const pillSize = PILL_SIZES[Math.max(0, sizePresets.findIndex((preset) => preset.value === size))] ?? 'md';
  const PillOrb = orbComponent(orb.id);
  const pillScale = pillScaleFor(orb.id);
  const providerLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? 'Generic';

  const applyPreset = (from: string, to: string) => {
    setColorFrom(from);
    setColorTo(to);
  };

  const reset = () => {
    setColorFrom(orb.defaultColorFrom);
    setColorTo(orb.defaultColorTo);
    setSize(orb.defaultSize);
    setSpeed(DEFAULT_SPEED);
  };

  return (
    <article
      id={orb.id}
      className="flex scroll-mt-20 flex-col gap-6 rounded-2xl border border-border bg-panel/60 p-5"
    >
      {!hideHeader && (
        <header className="flex flex-col gap-2">
          <h2 className="min-w-0 text-lg font-semibold">{orb.name}</h2>
          <p className="text-sm text-muted">{orb.tagline}</p>
        </header>
      )}

      <Group
        title="Preview"
        level={groupLevel}
        action={
          <div role="group" aria-label="Preview mode" className={PILL_GROUP}>
            {PREVIEW_VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
                className={pillButton(view === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid min-h-64 place-items-center rounded-xl border border-border bg-[radial-gradient(circle_at_50%_30%,var(--orb-stage-from),var(--orb-stage-to))] px-4 text-foreground">
          {view === 'pill' && PillOrb ? (
            <OrbPill
              orb={PillOrb}
              state={state}
              size={pillSize}
              speed={speed}
              colorFrom={colorFrom}
              colorTo={colorTo}
              levelRef={stageLevelRef}
              messages={steps.length ? { thinking: steps } : undefined}
              orbScale={pillScale}
            />
          ) : (
            <OrbPreview
              id={orb.id}
              state={state}
              size={size}
              speed={speed}
              colorFrom={colorFrom}
              colorTo={colorTo}
              levelRef={stageLevelRef}
              label={orb.name}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={demo.toggle}
              aria-pressed={demo.running}
              aria-describedby={transportHelpId}
              className={transportChip(demo.running)}
            >
              {demo.running ? <PauseIcon /> : <PlayIcon />}
              {demo.running ? 'Pause demo' : 'Play demo'}
            </button>
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={mic && !micError}
              aria-describedby={transportHelpId}
              disabled={state === 'disabled'}
              className={clsx(
                'disabled:cursor-not-allowed disabled:opacity-50',
                micError
                  ? 'inline-flex min-h-10 items-center gap-1.5 rounded-md border border-foreground/40 bg-panel px-3 text-xs font-medium text-foreground transition-colors sm:min-h-8'
                  : transportChip(mic),
              )}
            >
              {micError ? <MicOffIcon /> : mic ? <MicIcon /> : <MicOffIcon />}
              {micError ? MIC_ERROR_LABEL[micError] : mic ? 'Mic on' : 'Mic off'}
            </button>
            <OrbStatus state={state} className="ml-auto text-xs text-muted" />
          </div>
          <p id={transportHelpId} className="text-xs text-muted">
            {micError
              ? MIC_ERROR_TEXT[micError]
              : 'The demo cycles the five states. The mic makes the orb react to your voice while listening or speaking.'}
          </p>
        </div>
        <Field label="State">
          <div role="group" aria-label="Conversation states" className={PILL_GROUP}>
            {ORB_STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => selectState(s)}
                aria-pressed={state === s}
                className={pillButton(state === s)}
              >
                {STATE_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
        {view === 'pill' && (
          <Field label="Thinking steps">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={stepsText}
                onChange={(event) => setStepsText(event.target.value)}
                placeholder="Fetching prices, Running the numbers"
                aria-describedby={stepsHelpId}
                className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent sm:min-h-8 sm:max-w-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setStepsText(EXAMPLE_STEPS);
                  selectState('thinking');
                }}
                className={SECONDARY_BUTTON}
              >
                Try an example
              </button>
            </div>
            <p id={stepsHelpId} className="text-muted">
              Separate steps with commas; they rotate while the assistant is thinking.
            </p>
          </Field>
        )}
        <Disclosure label="Advanced">
          <Field label="Optional states">
            <div role="group" aria-label="Optional states" className={PILL_GROUP}>
              {SPECIAL_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => selectState(s)}
                  aria-pressed={state === s}
                  className={pillButton(state === s)}
                >
                  {STATE_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCues((prev) => !prev)}
              aria-pressed={cues}
              className={transportChip(cues)}
            >
              {cues ? <SoundIcon /> : <SoundOffIcon />}
              {cues ? 'Cues on' : 'Cues off'}
            </button>
            <span className="text-xs text-muted">
              Subtle sounds (and haptics where supported) on state changes.
            </span>
          </div>
        </Disclosure>
      </Group>

      <div className="grid gap-6 border-t border-border pt-6 md:grid-cols-2 md:gap-8">
        <Group
          title="Customize"
          level={groupLevel}
          action={
            <button type="button" onClick={reset} disabled={pristine} className={clsx(SECONDARY_BUTTON, 'disabled:cursor-not-allowed disabled:opacity-50')}>
              Reset
            </button>
          }
        >
          <Field label="Color" value={colorName}>
            <ColorPresetSwatches
              presets={presets}
              colorFrom={colorFrom}
              colorTo={colorTo}
              onSelect={applyPreset}
            />
            <Disclosure label="Custom colors">
              <div className="flex flex-wrap items-center gap-4">
                <ColorField label="From" value={colorFrom} onChange={setColorFrom} />
                <ColorField label="To" value={colorTo} onChange={setColorTo} />
              </div>
            </Disclosure>
          </Field>
          <Field label="Size" value={`${size}px`}>
            <SegmentedControl
              label="Size"
              options={sizePresets}
              value={size}
              onChange={setSize}
              defaultValue={orb.defaultSize}
            />
          </Field>
          <Field label="Speed" value={`${speed}×`}>
            <SegmentedControl
              label="Speed"
              options={SPEED_PRESETS}
              value={speed}
              onChange={setSpeed}
              defaultValue={DEFAULT_SPEED}
            />
          </Field>
          <p className="text-xs text-muted">A dot marks each default.</p>
        </Group>

        <Group title="Get the code" level={groupLevel}>
          {hasTailwind && (
            <Field label="Styling">
              <div role="group" aria-label="Styling variant" className={PILL_GROUP}>
                {VARIANT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVariant(option.value)}
                    aria-pressed={activeVariant === option.value}
                    className={pillButton(activeVariant === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={aiPrompt} label="Copy AI prompt" variant="solid" />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                aria-expanded={showCode}
                className={SECONDARY_BUTTON}
              >
                {showCode ? 'Hide code' : 'View code'}
              </button>
            </div>
            <p className="text-xs text-muted">
              The prompt bundles every file plus your current settings, set up for{' '}
              <span className="text-foreground">{providerLabel}</span>.
            </p>
          </div>
          {orb.dependencies.length > 0 ? (
            <Field label="Install">
              <InstallBlock dependencies={orb.dependencies} />
            </Field>
          ) : (
            <p className="text-xs text-muted">Zero dependencies: copy the files and it just works.</p>
          )}
          <Disclosure label="More">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as PromptProvider)}
                options={PROVIDERS}
                ariaLabel="AI prompt provider"
              />
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                aria-expanded={showPrompt}
                className={SECONDARY_BUTTON}
              >
                {showPrompt ? 'Hide prompt' : 'View prompt'}
              </button>
              <OpenInStackblitz
                id={orb.id}
                name={orb.name}
                dependencies={orb.dependencies}
                files={cssModuleFiles}
                shared={shared}
                config={{ state, size, speed, colorFrom, colorTo }}
              />
            </div>
          </Disclosure>
        </Group>
      </div>

      {showPrompt && (
        <div
          className="relative rounded-lg border border-code-border bg-code"
          style={{ boxShadow: 'var(--code-shadow)' }}
        >
          <div className="absolute top-2 right-2 z-10">
            <CopyButton value={aiPrompt} label="Copy" />
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-code-muted">
            {aiPrompt}
          </pre>
        </div>
      )}
      {showCode && <CodeBlock key={activeVariant} files={codeFiles} />}
    </article>
  );
};
