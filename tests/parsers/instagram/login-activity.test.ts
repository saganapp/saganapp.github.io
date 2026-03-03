import { describe, it, expect, beforeEach } from "vitest";
import { parseLoginActivity } from "@/parsers/instagram/login-activity";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeLoginHtml(
  logins: { timestamp: string; ip: string; userAgent: string; language: string }[],
): string {
  const blocks = logins
    .map(
      (l) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${l.timestamp}</h2>
        <div class="_a6-p">
          <table>
            <tr><td class="_a6_q">IP Address</td><td class="_2piu _a6_r">${l.ip}</td></tr>
            <tr><td class="_a6_q">User Agent</td><td class="_2piu _a6_r">${l.userAgent}</td></tr>
            <tr><td class="_a6_q">Language Code</td><td class="_2piu _a6_r">${l.language}</td></tr>
          </table>
        </div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseLoginActivity", () => {
  beforeEach(() => resetIdCounter());

  it("parses login events with IP and user agent", () => {
    const html = makeLoginHtml([
      {
        timestamp: "2024-06-15T10:30:00+00:00",
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        language: "en",
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

  it("parses multiple logins", () => {
    const html = makeLoginHtml([
      { timestamp: "2024-06-15T10:30:00+00:00", ip: "10.0.0.1", userAgent: "UA1", language: "en" },
      { timestamp: "2024-06-16T08:00:00+00:00", ip: "10.0.0.2", userAgent: "UA2", language: "es" },
    ]);

    const events = parseLoginActivity(html);
    expect(events).toHaveLength(2);
  });

  it("returns empty array for HTML without logins", () => {
    const html = "<html><body><h1>Empty</h1></body></html>";
    const events = parseLoginActivity(html);
    expect(events).toHaveLength(0);
  });
});
