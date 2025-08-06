import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Bangers, Karla } from 'next/font/google'

const bangers = Bangers({ 
  subsets: ['latin'], 
  weight: '400',
  variable: '--font-bangers',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-karla',
});


export const metadata: Metadata = {
  title: 'Annotator AI',
  description: 'Evaluate image annotation submissions with detailed feedback.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bangers.variable} ${karla.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
