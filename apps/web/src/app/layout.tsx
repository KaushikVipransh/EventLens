import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sora',
});

export const metadata: Metadata = {
  title: 'EventLens — find yourself in every photo',
  description:
    'Centralize event photos from every photographer. Attendees find their own photos with a selfie.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
