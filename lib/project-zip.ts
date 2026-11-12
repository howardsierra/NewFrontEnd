import { safeProjectPath } from "./generated-files";
import type { FileVersion } from "./file-library";

export function archivePaths(files: Pick<FileVersion, "filename" | "path">[]): string[] {
  const used = new Set<string>();
  return files.map((file) => {
    const requested = file.path || file.filename;
    const path = safeProjectPath(requested);
    if (!path) throw new Error(`Invalid project path: ${requested}`);
    let result = path;
    let index = 2;
    while (used.has(result.toLowerCase())) {
      const slash = path.lastIndexOf("/");
      const dot = path.lastIndexOf(".");
      result = dot > slash ? `${path.slice(0, dot)}-${index++}${path.slice(dot)}` : `${path}-${index++}`;
    }
    used.add(result.toLowerCase());
    return result;
  });
}

export async function createProjectZip(files: FileVersion[]): Promise<Blob> {
  if (!files.length || files.length > 50) throw new Error("Select between 1 and 50 files for a ZIP download.");
  if (files.reduce((size, file) => size + new TextEncoder().encode(file.content).byteLength, 0) > 20_000_000) throw new Error("This project is too large. Download smaller groups of files.");
  const [{ default: JSZip }, { createDocument }] = await Promise.all([import("jszip"), import("./documents")]);
  const zip = new JSZip();
  const paths = archivePaths(files);
  for (let i = 0; i < files.length; i++) {
    const blob = await createDocument(paths[i].split("/").pop()!, files[i].content);
    zip.file(paths[i], await blob.arrayBuffer());
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
