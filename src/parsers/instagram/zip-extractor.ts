import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
const SUB_CHUNK_SIZE = 65536; // 64 KB

export interface ExtractedFile {
  name: string;
  data: Uint8Array;
}

/** Only extract HTML files we care about */
function shouldExtract(filename: string): boolean {
  if (!filename.endsWith(".html")) return false;
  if (filename.includes("personal_information/personal_information/personal_information.html")) return true;
  if (filename.includes("/messages/") && filename.includes("message_")) return true;
  if (filename.includes("/likes/liked_posts.html")) return true;
  if (filename.includes("login_activity.html")) return true;
  if (filename.includes("followers_and_following/")) return true;
  if (filename.includes("saved/saved_posts.html")) return true;
  if (filename.includes("ads_information/ads_and_topics/")) return true;
  return false;
}

/**
 * Stream relevant HTML files from an Instagram archive ZIP.
 * Reads in chunks to keep memory low.
 */
export async function* streamInstagramFiles(
  file: File,
  onChunkRead?: (bytesRead: number, totalBytes: number) => void,
): AsyncGenerator<ExtractedFile> {
  const totalBytes = file.size;
  let offset = 0;

  const completed: ExtractedFile[] = [];
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

    for (let j = 0; j < chunk.length; j += SUB_CHUNK_SIZE) {
      const subEnd = Math.min(j + SUB_CHUNK_SIZE, chunk.length);
      const isFinal = end >= totalBytes && subEnd >= chunk.length;
      unzipper.push(chunk.subarray(j, subEnd), isFinal);

      while (completed.length > 0) {
        yield completed.shift()!;
      }
    }

    offset = end;
    onChunkRead?.(offset, totalBytes);
  }
}
