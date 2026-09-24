import type { Metadata, Viewport } from "next";
import { Geist, Literata, Lora, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const sansKr = Noto_Sans_KR({ weight: ["400", "500"], variable: "--font-sans-kr", display: "swap" });
const serifKr = Noto_Serif_KR({ weight: ["400", "600"], variable: "--font-serif-kr", display: "swap" });

const themeBoot = `(function(){try{var t=localStorage.getItem('paper-ui-theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;if(r!=='light'&&r!=='dark')r='light';document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "PAPER",
  description: "이야기를 모으고 읽는 개인적인 서재.",
  applicationName: "PAPER",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PAPER",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geist.variable} ${literata.variable} ${lora.variable} ${sansKr.variable} ${serifKr.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
