import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSessionGestor } from "@/actions/auth";
import { AppShell } from "@/components/AppShell";
import { Nav } from "@/components/Nav";
import "./globals.css";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const gestor = await getSessionGestor();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-brand-background text-brand-secondary">
        <AppShell
          nav={
            <Nav
              isDiretoria={gestor?.isDiretoria ?? false}
              nomeGestor={gestor?.nome}
            />
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
