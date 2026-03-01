/**
 * Extract the user's display name from personal_information.html.
 *
 * The HTML contains a table with fields in consistent order:
 *   email, phone_confirmed, username, **name**, gender, dob, privacy, emoji_pong
 *
 * Each field is a `<td class="_2pin _a6_q">` with a nested `<div><div>value</div></div>`.
 */
export function extractDisplayName(html: string): { displayName: string | null; username: string | null } {
  // Extract all values from _2pin _a6_q table cells
  const cellRegex = /_2pin _a6_q">(.*?)<\/td>/gs;
  const values: string[] = [];

  let match;
  while ((match = cellRegex.exec(html)) !== null) {
    // Extract the inner value from <div><div>value</div></div>
    const innerMatch = match[1].match(/<div><div>(.*?)<\/div><\/div>/s);
    if (innerMatch) {
      // Decode HTML entities
      values.push(decodeHtmlEntities(innerMatch[1]));
    }
  }

  // Field order: email(0), phone_confirmed(1), username(2), name(3)
  const username = values[2] ?? null;
  const displayName = values[3] ?? null;

  return { displayName, username };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#064;/g, "@")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
