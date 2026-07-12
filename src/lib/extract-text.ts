export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the 10MB limit.");
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return (await file.text()).trim();
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }
  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(file);
  }
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

async function extractPdf(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out +=
        content.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" ") + "\n";
    }
    const text = out.trim();
    if (!text) throw new Error("empty");
    return text;
  } catch (err) {
    console.error("PDF extraction failed:", err);
    throw new Error(
      "Could not extract text from this PDF. It may be scanned/image-based — try pasting the text instead.",
    );
  }
}

async function extractDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = result.value.trim();
    if (!text) throw new Error("empty");
    return text;
  } catch (err) {
    console.error("DOCX extraction failed:", err);
    throw new Error("Could not extract text from this DOCX file. Try pasting the text instead.");
  }
}
