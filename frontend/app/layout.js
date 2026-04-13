import "./globals.css";
import { Providers } from "./providers";
import { DM_Sans, Manrope, JetBrains_Mono, Source_Code_Pro } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display-fallback',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-fallback',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: "Agentic Lending",
  description:
    "End-to-end agentic lending platform powered by MongoDB Atlas, LangGraph, and Voyage AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable} ${jetbrainsMono.variable} ${sourceCodePro.variable}`}>
      <head>
        <link rel="preconnect" href="https://d2va9gm4j17fy9.cloudfront.net" />
        <link
          rel="stylesheet"
          href="https://d2va9gm4j17fy9.cloudfront.net/fonts/euclid-circular-a.css"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
