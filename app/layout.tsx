import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { getSessionGestor } from "@/actions/auth";
import { AppShell } from "@/components/AppShell";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const instant = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema Meritocracia",
  description: "Gestão de avaliações e meritocracia",
};

async function NavAutenticada() {
  const gestor = await getSessionGestor();
  return (
    <Nav
      isDiretoria={gestor?.isDiretoria ?? false}
      nomeGestor={gestor?.nome}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-brand-background text-brand-secondary">
        <AppShell
          nav={
            <Suspense fallback={<Nav isDiretoria={false} />}>
              <NavAutenticada />
            </Suspense>
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
