import type { PromptProvider } from '@/registry/prompt';

export const PROVIDERS: { value: PromptProvider; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'vapi', label: 'Vapi' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'livekit', label: 'LiveKit' },
  { value: 'openai-realtime', label: 'OpenAI Realtime' },
];

export const PROVIDER_VALUES = PROVIDERS.map((p) => p.value);

export const PROVIDER_STORAGE_KEY = 'voiceorbs:provider';
