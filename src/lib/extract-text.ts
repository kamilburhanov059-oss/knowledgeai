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

// pdfjs-dist relies on Promise.withResolvers(), unsupported in Safari < 17.4.
// The polyfill has to run inside the pdf.js Web Worker too (not just the main
// thread), so we fetch the worker script, prepend the polyfill, and load it
// from a blob URL instead of pointing workerSrc straight at the CDN.
const PROMISE_WITH_RESOLVERS_POLYFILL = `if(typeof Promise.withResolvers!=="function"){Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return{promise,resolve,reject};};}\n`;

function polyfillPromiseWithResolvers() {
  if (typeof Promise.withResolvers === "function") return;
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

async function getPatchedWorkerSrc(cdnUrl: string): Promise<string> {
  const res = await fetch(cdnUrl);
  const code = await res.text();
  const blob = new Blob([PROMISE_WITH_RESOLVERS_POLYFILL + code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}

async function extractPDF(file: File): Promise<string> {
  polyfillPromiseWithResolvers();
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = await getPatchedWorkerSrc(
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  );

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
