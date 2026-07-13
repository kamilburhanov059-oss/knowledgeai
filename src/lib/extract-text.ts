export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "txt" || ext === "md") {
    return file.text();
  }

  if (ext === "pdf") {
    return extractPDF(file);
  }

  if (ext === "docx") {
    return extractDOCX(file);
  }

  if (ext === "doc") {
    throw new Error("Формат .doc не поддерживается. Откройте файл в Word и сохраните как .docx или PDF");
  }

  // Fallback — try reading as plain text
  try {
    return await file.text();
  } catch {
    throw new Error(`Формат .${ext} не поддерживается`);
  }
}

async function extractPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => (item as { str?: string }).str ?? "")
      .join(" ");
    if (text.trim()) pages.push(`[[PAGE:${i}]]\n${text}`);
  }

  return pages.join("\n\n");
}

async function extractDOCX(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
