import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Content, ContentText, TDocumentDefinitions } from "pdfmake/interfaces";
import { generatedFileFormat } from "./generated-files";

interface Node { type: string; value?: string; children?: Node[]; depth?: number; ordered?: boolean; start?: number; alt?: string }
interface Run { text: string; bold?: boolean; italics?: boolean }
function runs(node: Node, style: Omit<Run, "text"> = {}): Run[] {
  if (node.type === "strong") style = { ...style, bold: true };
  if (node.type === "emphasis") style = { ...style, italics: true };
  if (node.value !== undefined) return [{ text: node.value, ...style }];
  if (node.type === "break") return [{ text: "\n", ...style }];
  if (node.type === "image") return [{ text: `[Image: ${node.alt || "image"}]`, ...style }];
  return (node.children ?? []).flatMap((child) => runs(child, style));
}
function parse(markdown: string): Node {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Node;
}
function pdfBlock(node: Node): Content {
  const children = node.children ?? [];
  switch (node.type) {
    case "heading": return { text: runs(node), bold: true, fontSize: Math.max(12, 24 - (node.depth ?? 1) * 2), margin: [0, 12, 0, 8] };
    case "list": return node.ordered ? { ol: children.map(pdfBlock), start: node.start ?? 1, margin: [0, 0, 0, 8] } : { ul: children.map(pdfBlock), margin: [0, 0, 0, 8] };
    case "listItem": case "blockquote": return { stack: children.map(pdfBlock) };
    case "code": return { text: node.value || " ", fontSize: 9, preserveLeadingSpaces: true, margin: [0, 4, 0, 10], color: "#334155" };
    case "table": return { table: { headerRows: 1, widths: Array(children[0]?.children?.length ?? 1).fill("*"), body: children.map((row, i) => (row.children ?? []).map((cell) => ({ text: runs(cell), bold: i === 0 }))) }, layout: "lightHorizontalLines", margin: [0, 6, 0, 12] };
    case "thematicBreak": return { text: "────────────", color: "#94a3b8", margin: [0, 8, 0, 8] };
    default: return { text: runs(node), margin: [0, 0, 0, 9] };
  }
}

export function pdfDefinition(markdown: string, title: string): TDocumentDefinitions {
  return { info: { title }, pageSize: "A4", pageMargins: [48, 48, 48, 48], defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.25 }, content: (parse(markdown).children ?? []).map(pdfBlock) };
}

export async function createDocument(filename: string, source: string): Promise<Blob> {
  const format = generatedFileFormat(filename);
  if (new TextEncoder().encode(source).byteLength > 3_500_000) throw new Error("This file is too large to create in the browser. Ask for smaller files.");
  if (format === "pdf") {
    const [{ default: pdfMake }, { default: fonts }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
    const pdf = pdfMake.createPdf(pdfDefinition(source, filename), undefined, undefined, fonts as unknown as Record<string, string>);
    return await new Promise<Blob>((resolve) => pdf.getBlob(resolve));
  }
  if (format === "docx") {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, Packer } = await import("docx");
    const paragraph = (node: Node, options = {}) => new Paragraph({ children: runs(node).map((run) => new TextRun(run)), spacing: { after: 160 }, ...options });
    const blocks = (node: Node): Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> => {
      const children = node.children ?? [];
      if (node.type === "heading") {
        const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
        return [paragraph(node, { heading: levels[(node.depth ?? 1) - 1] })];
      }
      if (node.type === "table") return [new Table({ rows: children.map((row) => new TableRow({ children: (row.children ?? []).map((cell) => new TableCell({ children: [paragraph(cell)] })) })) })];
      if (node.type === "list") return children.map((item, i) => new Paragraph({ children: [new TextRun(node.ordered ? `${(node.start ?? 1) + i}. ` : "• "), ...runs(item).map((run) => new TextRun(run))], spacing: { after: 120 } }));
      if (node.type === "blockquote") return children.flatMap(blocks);
      if (node.type === "code") return (node.value ?? "").split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Courier New", size: 20 })] }));
      return [paragraph(node)];
    };
    return Packer.toBlob(new Document({ title: filename, sections: [{ children: (parse(source).children ?? []).flatMap(blocks) }] }));
  }
  if (format === "json") { try { JSON.parse(source); } catch { throw new Error("The generated JSON is invalid. Ask the model to correct it before downloading."); } }
  if (format === "jsonl") { try { source.split(/\r?\n/).filter((line) => line.trim()).forEach((line) => JSON.parse(line)); } catch { throw new Error("A JSONL row is invalid. Ask the model to correct it."); } }
  return new Blob([format === "csv" ? "\uFEFF" + source : source], { type: format === "json" ? "application/json;charset=utf-8" : format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
}
