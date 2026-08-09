import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/lib/query-provider';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  variable: '--font-be-vietnam',
  weight: ['400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {};

export const viewport: Viewport = {
  themeColor: '#1c1a18',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${beVietnamPro.variable} ${jetBrainsMono.variable}`}>
      <body>
        <QueryProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
