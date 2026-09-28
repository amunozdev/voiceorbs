import { GitHubIcon } from '@/components/github-link';

const REPO_URL = 'https://github.com/amunozdev/voiceorbs';
const CONTRIBUTE_URL = 'https://github.com/amunozdev/voiceorbs/blob/main/CONTRIBUTING.md';
const GOOD_FIRST_ISSUE_URL =
  'https://github.com/amunozdev/voiceorbs/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22';
const X_URL = 'https://x.com/alexmunoz1_';

const LINK_CLASS = 'text-muted transition-colors hover:text-foreground';

export const Footer = () => (
  <footer className="mt-auto border-t border-border">
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-10">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-accent-foreground"
          >
            <GitHubIcon />
            amunozdev/voiceorbs
          </a>
        </div>
        <p className="text-xs text-muted">
          Open source under the{' '}
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-foreground hover:underline"
          >
            MIT License
          </a>
          . Built by{' '}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-foreground hover:underline"
          >
            @alexmunoz1_
          </a>
          .
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a href={CONTRIBUTE_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Contribute
        </a>
        <a
          href={GOOD_FIRST_ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Good first issues
        </a>
        <a href="/llms.txt" className={LINK_CLASS}>
          llms.txt
        </a>
      </nav>
    </div>
  </footer>
);
