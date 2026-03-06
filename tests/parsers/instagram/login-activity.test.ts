import { describe, it, expect, beforeEach } from "vitest";
import { parseLoginActivity } from "@/parsers/instagram/login-activity";
import { resetIdCounter } from "@/parsers/instagram/utils";

/** Actual GDPR export format: _a6_q cells with nested <div><div>value</div></div> */
function makeLoginHtml(
  logins: { timestamp: string; ip: string; userAgent: string; language: string; localDate: string }[],
): string {
  const blocks = logins
    .map(
      (l) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${l.timestamp}</h2>
        <div class="_a6-p"><table>
          <tr><td colspan="2" class="_2pin _a6_q">IP Address<div><div>${l.ip}</div></div></td></tr>
          <tr><td colspan="2" class="_2pin _a6_q">Language Code<div><div>${l.language}</div></div></td></tr>
          <tr><td class="_2pin _a6_q">Date and Time</td><td class="_2pin _2piu _a6_r">${l.localDate}</td></tr>
          <tr><td colspan="2" class="_2pin _a6_q">User Agent<div><div>${l.userAgent}</div></div></td></tr>
        </table></div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseLoginActivity", () => {
  beforeEach(() => resetIdCounter());

  it("parses login events with IP, user agent, and language", () => {
    const html = makeLoginHtml([
      {
        timestamp: "2024-06-15T10:30:00+00:00",
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        language: "en",
        localDate: "jun. 15, 2024 2:30 am",
      },
    ]);

    const events = parseLoginActivity(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("login");
    expect(events[0].metadata.ip).toBe("192.168.1.1");
    expect(events[0].metadata.userAgent).toBe("Mozilla/5.0");
    expect(events[0].metadata.language).toBe("en");
  });

  it("parses Spanish-localized labels", () => {
    const html = `<html><body>
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">2024-07-05T10:49:31+00:00</h2>
        <div class="_a6-p"><table>
          <tr><td colspan="2" class="_2pin _a6_q">Dirección IP<div><div>147.161.191.114</div></div></td></tr>
          <tr><td colspan="2" class="_2pin _a6_q">Código de idioma<div><div>en</div></div></td></tr>
          <tr><td class="_2pin _a6_q">Fecha y hora</td><td class="_2pin _2piu _a6_r">jul. 05, 2024 2:49 am</td></tr>
          <tr><td colspan="2" class="_2pin _a6_q">Agente de usuario<div><div>Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1)</div></div></td></tr>
        </table></div>
      </div>
    </body></html>`;

    const events = parseLoginActivity(html);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.ip).toBe("147.161.191.114");
    expect(events[0].metadata.language).toBe("en");
    expect(events[0].metadata.userAgent).toBe(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1)",
    );
  });

  it("parses multiple logins", () => {
    const html = makeLoginHtml([
      { timestamp: "2024-06-15T10:30:00+00:00", ip: "10.0.0.1", userAgent: "UA1", language: "en", localDate: "jun. 15, 2024 2:30 am" },
      { timestamp: "2024-06-16T08:00:00+00:00", ip: "10.0.0.2", userAgent: "UA2", language: "es", localDate: "jun. 16, 2024 12:00 am" },
    ]);

    const events = parseLoginActivity(html);
    expect(events).toHaveLength(2);
    expect(events[0].metadata.ip).toBe("10.0.0.1");
    expect(events[1].metadata.ip).toBe("10.0.0.2");
  });

  it("returns empty array for HTML without logins", () => {
    const html = "<html><body><h1>Empty</h1></body></html>";
    const events = parseLoginActivity(html);
    expect(events).toHaveLength(0);
  });
});
