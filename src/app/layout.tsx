import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Architects_Daughter } from 'next/font/google'

const architectsDaughter = Architects_Daughter({ 
  subsets: ['latin'], 
  weight: '400',
  variable: '--font-architects-daughter',
})

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
    <html lang="en" className={architectsDaughter.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
