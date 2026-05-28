import { readFile } from "node:fs/promises"
import path from "node:path"

const RH_SIGNATURE_PATH = path.join(process.cwd(), "signature-removebg-preview.png")

export async function getRhSignatureDataUrl() {
  const buffer = await readFile(RH_SIGNATURE_PATH)
  return `data:image/png;base64,${buffer.toString("base64")}`
}
