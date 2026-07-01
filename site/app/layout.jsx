import 'storydeck/storydeck.css';
import './globals.css';
import { StoryDeckProvider, ThemeToggle } from 'storydeck';
import { BASE, SITE } from '../site.config';

export const metadata = {
  metadataBase: new URL(SITE),
  title: 'storydeck — one source, many lenses',
  description: 'A React library: render content as a Read article, a Scroll story, or a Watch deck.',
  icons: { icon: `${BASE}/logo-foot.png` },
  alternates: { canonical: '/storydeck' },
  openGraph: { title: 'storydeck — one source, many lenses', description: 'Read · Scroll · Watch, from one source.', url: '/storydeck' },
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light')t='dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StoryDeckProvider basePath={BASE}>
          <a className="skip-link" href="#main">Skip to content</a>
          <header className="site-hd">
            <a className="brand" href={`${BASE}/`}>
              <img src={`${BASE}/logo-foot.png`} alt="" width={26} height={26} />
              <span>storydeck</span>
            </a>
            <span className="sp" />
            <a className="nav" href="https://github.com/footprintjs/storydeck">GitHub</a>
            <a className="nav" href="https://footprintjs.github.io/">footprintjs</a>
            <ThemeToggle />
          </header>
          {children}
          <footer className="site-ft">
            open source · <a href="https://github.com/footprintjs/storydeck/blob/main/LICENSE">MIT</a> · a{' '}
            <a href="https://footprintjs.github.io/">footprintjs</a> library
          </footer>
        </StoryDeckProvider>
      </body>
    </html>
  );
}
