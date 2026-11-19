import type { jsPDF } from "jspdf";

function sanitizarNomeArquivo(nomeArquivo: string): string {
  const base = nomeArquivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const semExtensao = base.replace(/\.pdf$/i, "") || "documento";
  return `${semExtensao}.pdf`;
}

function isHttpNaoLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  if (protocol !== "http:") return false;
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

export function baixarOuAbrirPdf(doc: jsPDF, nomeArquivo: string): void {
  const nome = sanitizarNomeArquivo(nomeArquivo);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = nome;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isHttpNaoLocalhost()) {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
