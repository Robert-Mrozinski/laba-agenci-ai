export function splitIntoChunks(
  text: string,
  chunkSize: number = 500,
  overlap: number = 50,
): string[] {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  if (!normalizedText) {
    return [];
  }

  const sentences =
    normalizedText.match(/[^.!?\n]+[.!?]?|\n+/g)?.map((part) => part.trim()).filter(Boolean) ?? [
      normalizedText,
    ];

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (!currentChunk) {
      currentChunk = sentence;
      continue;
    }

    const nextChunk = `${currentChunk} ${sentence}`.trim();

    if (nextChunk.length <= chunkSize) {
      currentChunk = nextChunk;
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = `${getOverlap(currentChunk, overlap)} ${sentence}`.trim();

    while (currentChunk.length > chunkSize) {
      chunks.push(currentChunk.slice(0, chunkSize).trim());
      currentChunk = `${getOverlap(currentChunk.slice(0, chunkSize), overlap)} ${currentChunk
        .slice(chunkSize)
        .trim()}`.trim();
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(Boolean);
}

function getOverlap(text: string, overlap: number) {
  if (overlap <= 0 || text.length <= overlap) {
    return text;
  }

  const overlapText = text.slice(-overlap);
  const wordBoundary = overlapText.indexOf(' ');

  return wordBoundary >= 0 ? overlapText.slice(wordBoundary + 1) : overlapText;
}
