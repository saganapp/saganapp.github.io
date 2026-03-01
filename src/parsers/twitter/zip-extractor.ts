import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
// fflate's Unzip.push() is recursive — it calls itself for every ZIP entry
// found within the pushed data. Twitter archives contain thousands of small
// asset files, so a single 8 MB push can trigger thousands of recursive calls
// and overflow the stack. We feed fflate small sub-chunks to bound recursion.
const SUB_CHUNK_SIZE = 65536; // 64 KB

export interface ExtractedFile {
  name: string;
  data: Uint8Array;
}

/**
 * Only extract data/*.js files (the actual data), skipping:
 * - assets/ (viewer app code, i18n, CSS)
 * - media/ and other binary content
 */
function shouldExtract(filename: string): boolean {
  return /^data\/.*\.js$/.test(filename);
}

/**
 * Stream data JS files from a Twitter archive ZIP one at a time.
 * Reads the ZIP via File.slice() in 8 MB chunks and decompresses
 * using fflate's streaming Unzip, keeping peak memory low.
 */
export async function* streamTwitterDataFiles(
  file: File,
  onChunkRead?: (bytesRead: number, totalBytes: number) => void,
): AsyncGenerator<ExtractedFile> {
  const totalBytes = file.size;
  let offset = 0;

  // Files that completed decompression during the current push(), ready to yield
  const completed: ExtractedFile[] = [];

  // Per-file chunk accumulators for files still being decompressed
  const accumulators = new Map<string, Uint8Array[]>();

  const unzipper = new Unzip();
  unzipper.register(UnzipInflate);
  unzipper.register(UnzipPassThrough);

  unzipper.onfile = (entry) => {
    if (!shouldExtract(entry.name)) return;

    const chunks: Uint8Array[] = [];
    accumulators.set(entry.name, chunks);

    entry.ondata = (err, data, final) => {
      if (err) {
        accumulators.delete(entry.name);
        return;
      }

      chunks.push(data);

      if (final) {
        accumulators.delete(entry.name);

        // Concatenate decompression chunks into a single Uint8Array
        if (chunks.length === 1) {
          completed.push({ name: entry.name, data: chunks[0] });
        } else {
          const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Uint8Array(totalLength);
          let pos = 0;
          for (const chunk of chunks) {
            merged.set(chunk, pos);
            pos += chunk.length;
          }
          completed.push({ name: entry.name, data: merged });
        }
      }
    };

    entry.start();
  };

  while (offset < totalBytes) {
    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    const chunk = new Uint8Array(buffer);

    // Feed fflate in small sub-chunks to limit recursion depth
    for (let j = 0; j < chunk.length; j += SUB_CHUNK_SIZE) {
      const subEnd = Math.min(j + SUB_CHUNK_SIZE, chunk.length);
      const isFinal = end >= totalBytes && subEnd >= chunk.length;
      unzipper.push(chunk.subarray(j, subEnd), isFinal);

      // Yield any files that completed decompression during this push
      while (completed.length > 0) {
        yield completed.shift()!;
      }
    }

    offset = end;
    onChunkRead?.(offset, totalBytes);
  }
}
