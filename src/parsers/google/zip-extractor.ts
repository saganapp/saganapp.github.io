import { unzip } from "fflate";

/**
 * Regex patterns for metadata-rich files we want to extract.
 * Everything else (media, binaries, large files) is skipped.
 */
const INCLUDE_PATTERNS = [
  /My Activity\/.*\.(?:json|html)$/,
  /Google Chat\/.*messages\.json$/,
  /Chrome\/(?:BrowserHistory|History)\.json$/,
  /Calendar\/.*\.ics$/,
  /Contacts\/.*\.vcf$/,
  /Location History\/.*\.json$/,
  /Google Meet\/.*\.csv$/,
  /Purchases & Reservations\/.*\.json$/,
];

function shouldExtract(filename: string): boolean {
  // Strip leading "Takeout/" prefix if present
  const normalized = filename.replace(/^Takeout\//, "");
  return INCLUDE_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Extract metadata files from a Google Takeout zip.
 * Uses fflate's filter callback to skip non-metadata entries.
 */
export function extractMetadataFiles(
  zipData: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(zipData, { filter: (file) => shouldExtract(file.name) }, (err, data) => {
      if (err) {
        reject(new Error(`ZIP extraction failed: ${err.message}`));
        return;
      }
      const result = new Map<string, Uint8Array>();
      for (const [name, content] of Object.entries(data)) {
        result.set(name, content);
      }
      resolve(result);
    });
  });
}
