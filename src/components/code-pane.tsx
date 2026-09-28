'use client';

import clsx from 'clsx';
import { Highlight, themes } from 'prism-react-renderer';
import type { Language } from 'prism-react-renderer';
import { CopyButton } from './copy-button';

interface CodePaneProps {
  code: string;
  lang?: Language;
  copyLabel?: string;
  flush?: boolean;
  preClassName?: string;
}

export const CodePane = ({ code, lang = 'tsx', copyLabel = 'Copy', flush = false, preClassName }: CodePaneProps) => (
  <div
    className={clsx('relative bg-code', flush ? 'border-t border-code-border' : 'rounded-lg border border-code-border')}
    style={flush ? undefined : { boxShadow: 'var(--code-shadow)' }}
  >
    <div className="absolute right-2 top-2 z-10">
      <CopyButton value={code} label={copyLabel} />
    </div>
    <Highlight theme={themes.vsDark} code={code} language={lang}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          className={clsx('overflow-auto p-4 font-mono text-xs leading-relaxed text-code-foreground', preClassName)}
          style={{ background: 'transparent' }}
        >
          {tokens.map((line, lineIndex) => (
            <div key={lineIndex} {...getLineProps({ line })}>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  </div>
);
