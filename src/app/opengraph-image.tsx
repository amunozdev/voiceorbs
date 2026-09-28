import { ImageResponse } from 'next/og';
import { orbs } from '@/registry/registry';
import { OG_BG, OG_SIZE, ogFonts, ogImage } from '@/og/og-assets';

export const alt = 'VoiceOrbs: a Siri Sheet orb inside a status pill that reads Checking the database';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const [fonts, pill] = await Promise.all([ogFonts(), ogImage('og/pill.png')]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 56px 0 88px',
          backgroundColor: OG_BG,
          fontFamily: 'Geist',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 540 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#9aa1c2' }}>VoiceOrbs</div>
          <div
            style={{
              marginTop: 22,
              fontSize: 70,
              fontWeight: 600,
              color: '#f4f5fb',
              lineHeight: 1.02,
              letterSpacing: -3,
            }}
          >
            Animated orbs for AI assistants
          </div>
          <div style={{ marginTop: 26, fontSize: 29, color: '#9aa1c2', lineHeight: 1.35 }}>
            {`${orbs.length} copy-paste React orbs, now with status feedback for voice agents.`}
          </div>
        </div>
        <img src={pill} width={560} height={245} alt="" />
      </div>
    ),
    { ...size, fonts },
  );
}
