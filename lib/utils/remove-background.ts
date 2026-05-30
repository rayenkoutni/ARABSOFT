import { pathToFileURL } from "node:url";
import path from "node:path";
import { removeBackground as removeBackgroundNode } from "@imgly/background-removal-node";

const backgroundRemovalConfig = {
  debug: false,
  model: "small" as const,
  publicPath: `${pathToFileURL(path.join(process.cwd(), "node_modules", "@imgly", "background-removal-node", "dist")).href}/`,
  output: {
    format: "image/png" as const,
    quality: 1,
    type: "foreground" as const,
  },
};

function detectImageMimeType(inputBuffer: Buffer) {
  if (inputBuffer[0] === 0x89 && inputBuffer[1] === 0x50 && inputBuffer[2] === 0x4e && inputBuffer[3] === 0x47) {
    return "image/png";
  }

  if (inputBuffer[0] === 0xff && inputBuffer[1] === 0xd8 && inputBuffer[2] === 0xff) {
    return "image/jpeg";
  }

  return null;
}

export async function removeBackground(inputBuffer: Buffer): Promise<Buffer> {
  const mimeType = detectImageMimeType(inputBuffer);
  if (!mimeType) {
    throw new Error("Unsupported format");
  }

  const result = await removeBackgroundNode(new Blob([inputBuffer], { type: mimeType }), backgroundRemovalConfig);
  return Buffer.from(await result.arrayBuffer());
}
