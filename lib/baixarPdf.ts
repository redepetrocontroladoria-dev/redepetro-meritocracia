import type { jsPDF } from "jspdf";

export function baixarOuAbrirPdf(doc: jsPDF, nomeArquivo: string) {
  const nomeSeguro = nomeArquivo.endsWith(".pdf")
    ? nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, "-")
    : `${nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf`;

  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = nomeSeguro;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
