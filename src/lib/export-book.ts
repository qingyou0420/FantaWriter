import { EPUB_AUTHOR, EPUB_BOOK_ID_PREFIX } from "./brand";
import type { NovelProject, OutlineChapter, Volume } from "./types";
import { chaptersGroupedByVolume } from "./volumes";
import { createZip } from "./zip";

function chapterBody(project: NovelProject, ch: OutlineChapter): string {
  return project.chapters.find((c) => c.chapterId === ch.id)?.content || "";
}

function orderedChapters(project: NovelProject) {
  return chaptersGroupedByVolume(project).flatMap((g) =>
    g.chapters.map((ch) => ({
      ...ch,
      body: chapterBody(project, ch),
      volumeTitle: g.volume.title,
    }))
  );
}

export function volumeExportSections(project: NovelProject): {
  volume: Volume;
  chapters: (OutlineChapter & { body: string })[];
}[] {
  return chaptersGroupedByVolume(project).map((g) => ({
    volume: g.volume,
    chapters: g.chapters.map((ch) => ({
      ...ch,
      body: chapterBody(project, ch),
    })),
  }));
}

export function projectWordCount(project: NovelProject): number {
  return project.chapters.reduce(
    (n, c) => n + (c.content || "").replace(/\s/g, "").length,
    0
  );
}

export function buildMarkdownBook(project: NovelProject): string {
  const title = project.background.title || project.name || "novel";
  const sections = volumeExportSections(project);
  const parts = sections.map((sec) => {
    const head = `## ${sec.volume.title}`;
    const chs = sec.chapters.map((ch) => {
      const body = ch.body || "（尚未生成）";
      return `# 第 ${ch.order} 章 ${ch.title}\n\n${body}`;
    });
    return [head, ...chs].join("\n\n");
  });
  return `# ${title}\n\n${parts.join("\n\n---\n\n")}\n`;
}

export function buildTxtBook(project: NovelProject): string {
  const title = project.background.title || project.name || "novel";
  const sections = volumeExportSections(project);
  const parts = sections.map((sec) => {
    const head = `【${sec.volume.title}】`;
    const chs = sec.chapters.map((ch) => {
      const body = (ch.body || "（尚未生成）").replace(/^#+\s.*$/m, "").trim();
      return `第 ${ch.order} 章 ${ch.title}\n\n${body}`;
    });
    return [head, ...chs].join("\n\n\n");
  });
  return `${title}\n${"=".repeat(Math.min(title.length * 2, 40))}\n\n${parts.join("\n\n\n")}\n`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtmlParagraphs(text: string): string {
  const cleaned = text.replace(/^#\s+.*$/m, "").trim();
  return cleaned
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeXml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

export function buildEpubBlob(project: NovelProject): Blob {
  const title = project.background.title || project.name || "novel";
  const author = EPUB_AUTHOR;
  const chapters = orderedChapters(project);
  const bookId = `${EPUB_BOOK_ID_PREFIX}-${project.id.slice(0, 8)}`;

  const files: { name: string; data: string }[] = [
    { name: "mimetype", data: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    },
  ];

  const manifestItems = chapters
    .map(
      (ch, i) =>
        `    <item id="ch${i}" href="chap${i}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n");
  const spine = chapters
    .map((_, i) => `    <itemref idref="ch${i}"/>`)
    .join("\n");
  const navPoints = chapters
    .map(
      (ch, i) => `    <navPoint id="nav${i}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(ch.volumeTitle)} · 第 ${ch.order} 章 ${escapeXml(ch.title)}</text></navLabel>
      <content src="chap${i}.xhtml"/>
    </navPoint>`
    )
    .join("\n");

  files.push({
    name: "OEBPS/content.opf",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh</dc:language>
    <dc:identifier id="BookId">${bookId}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`,
  });

  files.push({
    name: "OEBPS/toc.ncx",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookId}"/></head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`,
  });

  chapters.forEach((ch, i) => {
    const volHead =
      i === 0 || ch.volumeTitle !== chapters[i - 1].volumeTitle
        ? `<h1>${escapeXml(ch.volumeTitle)}</h1>\n`
        : "";
    files.push({
      name: `OEBPS/chap${i}.xhtml`,
      data: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(ch.title)}</title>
  <style>
    body { font-family: serif; line-height: 1.8; padding: 1.5em; }
    h1 { font-size: 1.4em; margin-bottom: 1em; }
    p { margin: 0.8em 0; text-indent: 2em; }
  </style>
</head>
<body>
  ${volHead}<h1>第 ${ch.order} 章 ${escapeXml(ch.title)}</h1>
  ${textToHtmlParagraphs(ch.body || "（尚未生成）")}
</body>
</html>`,
    });
  });

  // mimetype must be first and uncompressed — our STORE zip keeps order
  return createZip(files);
}

/** Word-compatible HTML document (.doc) — opens in Word/WPS without extra deps */
export function buildDocHtmlBlob(project: NovelProject): Blob {
  const title = project.background.title || project.name || "novel";
  const sections = volumeExportSections(project);
  const body = sections
    .map((sec) => {
      const vol = `<h1>${escapeXml(sec.volume.title)}</h1>`;
      const chs = sec.chapters.map(
        (ch) =>
          `<h2>第 ${ch.order} 章 ${escapeXml(ch.title)}</h2>\n${textToHtmlParagraphs(ch.body || "（尚未生成）")}`
      );
      return [vol, ...chs].join("\n");
    })
    .join("\n<hr/>\n");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<style>
body { font-family: "Microsoft YaHei", "PingFang SC", serif; line-height: 1.8; max-width: 40em; margin: 2em auto; }
h1 { font-size: 1.35em; margin-top: 1.5em; }
p { text-indent: 2em; margin: 0.6em 0; }
</style>
</head>
<body>
<h1>${escapeXml(title)}</h1>
${body}
</body>
</html>`;

  return new Blob(["\ufeff", html], { type: "application/msword" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ExportFormat = "md" | "txt" | "epub" | "doc";

export function exportBook(project: NovelProject, format: ExportFormat) {
  const base = (project.background.title || project.name || "novel").replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
  switch (format) {
    case "md":
      downloadBlob(
        new Blob([buildMarkdownBook(project)], {
          type: "text/markdown;charset=utf-8",
        }),
        `${base}.md`
      );
      break;
    case "txt":
      downloadBlob(
        new Blob([buildTxtBook(project)], { type: "text/plain;charset=utf-8" }),
        `${base}.txt`
      );
      break;
    case "epub":
      downloadBlob(buildEpubBlob(project), `${base}.epub`);
      break;
    case "doc":
      downloadBlob(buildDocHtmlBlob(project), `${base}.doc`);
      break;
  }
}

export function buildTocPreview(project: NovelProject): {
  order: number;
  title: string;
  words: number;
  status: string;
  hasContent: boolean;
  volumeId: string;
  volumeTitle: string;
}[] {
  return orderedChapters(project).map((ch) => {
    const content = ch.body || "";
    const words = content.replace(/\s/g, "").length;
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return {
      order: ch.order,
      title: ch.title,
      words,
      status: row?.status || "idle",
      hasContent: words > 0,
      volumeId: ch.volumeId || "",
      volumeTitle: ch.volumeTitle,
    };
  });
}
