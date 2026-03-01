import { decodeUtf8 } from "./utils";

export interface ContactInfo {
  name: string;
  emails: string[];
  phones: string[];
}

/**
 * Minimal VCF (vCard) parser — extracts name, email, phone.
 * Used for resolving participant names in other parsers.
 */
export function parseContacts(data: Uint8Array): ContactInfo[] {
  const text = decodeUtf8(data);
  // Unfold continuation lines
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const contacts: ContactInfo[] = [];
  let inCard = false;
  let name = "";
  let emails: string[] = [];
  let phones: string[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VCARD") {
      inCard = true;
      name = "";
      emails = [];
      phones = [];
      continue;
    }

    if (line === "END:VCARD") {
      if (inCard && (name || emails.length > 0)) {
        contacts.push({ name, emails, phones });
      }
      inCard = false;
      continue;
    }

    if (!inCard) continue;

    if (line.startsWith("FN")) {
      name = extractValue(line);
    } else if (line.startsWith("EMAIL")) {
      const email = extractValue(line);
      if (email) emails.push(email);
    } else if (line.startsWith("TEL")) {
      const phone = extractValue(line);
      if (phone) phones.push(phone);
    }
  }

  return contacts;
}

function extractValue(line: string): string {
  const colonIdx = line.indexOf(":");
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : "";
}
