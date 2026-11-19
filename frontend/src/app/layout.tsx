import type { Metadata } from "next";
import { Inter, Urbanist } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import RouteProgressBar from "@/components/RouteProgressBar";
import AppShell from "@/components/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skillio | Technical Hiring & IT Jobs",
  description:
    "Discover verified IT roles, analyze and refine your technical CV with AI, and track hiring applications in one focused platform.",
  openGraph: {
    title: "Skillio | Technical Hiring & IT Jobs",
    description:
      "Discover verified IT roles, analyze and refine your technical CV with AI, and track hiring applications in one focused platform.",
    type: "website",
    locale: "en_US",
    siteName: "Skillio",
  },
  icons: {
    icon: "/icon.svg",
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(t!=="light"&&d)){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${urbanist.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased font-sans`}
      >
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <RouteProgressBar />
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
