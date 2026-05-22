// Isolates the pdf.js library — the ONLY file in the app that knows PDFs
// exist. Same idea as storage.ts isolating localStorage: if we ever swap
// PDF libraries, just this file changes.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// pdf.js does its parsing on a separate background thread (a "Web Worker")
// so that opening a large PDF never freezes the interface. We just have to
// tell it where that worker file lives — the `?url` import gives us the path.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** Read a PDF file in the browser and return how many pages it has. */
export async function getPdfPageCount(file: File): Promise<number> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pageCount = pdf.numPages
  await pdf.destroy()
  return pageCount
}
