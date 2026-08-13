export type TaskLanguage = "html" | "css" | "js";

export type ReadonlyRange = {
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  content: string;
};

const markers = {
  html: {
    start: "<!-- readonly:start -->",
    end: "<!-- readonly:end -->",
  },
  css: {
    start: "/* readonly:start */",
    end: "/* readonly:end */",
  },
  js: {
    start: "/* readonly:start */",
    end: "/* readonly:end */",
  },
} as const;

export function getReadonlyMarkers(language: TaskLanguage) {
  return markers[language];
}

export function ensureReadonlyBlockSpacing(
  source: string,
  language: TaskLanguage,
) {
  const normalized = source.replace(/\r\n/g, "\n");

  try {
    parseReadonlyRanges(normalized, language);
  } catch {
    return normalized;
  }

  const { start, end } = markers[language];
  const lines = normalized.split("\n");
  const spacedLines: string[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (
      trimmed === start &&
      (spacedLines.length === 0 || spacedLines.at(-1)?.trim() !== "")
    ) {
      spacedLines.push("");
    }

    spacedLines.push(line);

    if (
      trimmed === end &&
      (index === lines.length - 1 || lines[index + 1]?.trim() !== "")
    ) {
      spacedLines.push("");
    }
  });

  return spacedLines.join("\n");
}

export function parseReadonlyRanges(
  source: string,
  language: TaskLanguage,
): ReadonlyRange[] {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const { start, end } = markers[language];
  const ranges: ReadonlyRange[] = [];
  let startIndex: number | null = null;
  const lineOffsets: number[] = [];
  let offset = 0;

  lines.forEach((line) => {
    lineOffsets.push(offset);
    offset += line.length + 1;
  });

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === start) {
      if (startIndex !== null) {
        throw new Error(`Nested readonly block at line ${index + 1}`);
      }
      startIndex = index;
      return;
    }

    if (trimmed === end) {
      if (startIndex === null) {
        throw new Error(
          `Readonly block ends without a start at line ${index + 1}`,
        );
      }

      ranges.push({
        startLine: startIndex + 1,
        endLine: index + 1,
        startOffset: lineOffsets[startIndex],
        endOffset: lineOffsets[index] + lines[index].length,
        content: lines.slice(startIndex, index + 1).join("\n"),
      });
      startIndex = null;
    }
  });

  if (startIndex !== null) {
    throw new Error(
      `Readonly block starting at line ${startIndex + 1} has no end`,
    );
  }

  return ranges;
}

export function preservesReadonlyBlocks(
  previousSource: string,
  nextSource: string,
  language: TaskLanguage,
) {
  try {
    const previousBlocks = parseReadonlyRanges(previousSource, language);
    const nextBlocks = parseReadonlyRanges(nextSource, language);

    return (
      previousBlocks.length === nextBlocks.length &&
      previousBlocks.every(
        (block, index) => block.content === nextBlocks[index]?.content,
      )
    );
  } catch {
    return false;
  }
}

export function canApplyStudentEdit(
  previousSource: string,
  nextSource: string,
  language: TaskLanguage,
) {
  const previous = previousSource.replace(/\r\n/g, "\n");
  const next = nextSource.replace(/\r\n/g, "\n");

  return preservesReadonlyBlocks(previous, next, language);
}

export function hasReadonlyBlocks(
  source: string | undefined,
  language: TaskLanguage,
) {
  if (!source) return false;

  try {
    return parseReadonlyRanges(source, language).length > 0;
  } catch {
    return false;
  }
}
