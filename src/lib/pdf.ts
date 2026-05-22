// Isolates the pdf.js library — the ONLY file in the app that knows PDFs
// exist. Same idea as storage.ts isolating localStorage: if we ever swap
// PDF libraries, just this file changes.

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, worker]) => {
      // pdf.js parses on a background worker. The `?url` import gives Vite's
      // built worker path without pulling pdf.js into the initial app chunk.
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjsLib
    })
  }

  return pdfJsPromise
}

/** Read a PDF file in the browser and return how many pages it has. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = await loadPdfJs()
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pageCount = pdf.numPages
  await pdf.destroy()
  return pageCount
}
