import { describe, it, expect, beforeEach } from "vitest";
import { parseInstagramMessages } from "@/parsers/instagram/messages";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeMessageHtml(
  conversationName: string,
  messages: { sender: string; date: string }[],
): string {
  const messageBlocks = messages
    .map(
      (m) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${m.sender}</h2>
        <div class="_3-95 _a6-p"><div><div></div><div>Hello!</div></div></div>
        <div class="_3-94 _a6-o">${m.date}</div>
      </div>`,
    )
    .join("\n");

  return `<html><body>
    <h1 id="u_0_1y_vn">${conversationName}</h1>
    <main class="_a706" role="main">
      ${messageBlocks}
    </main>
  </body></html>`;
}

describe("parseInstagramMessages", () => {
  beforeEach(() => resetIdCounter());

  it("only emits sent messages and skips received ones", () => {
    const html = makeMessageHtml("Friend", [
      { sender: "Ole", date: "ene. 15, 2024 10:30 am" },
      { sender: "Friend", date: "ene. 15, 2024 10:31 am" },
      { sender: "Ole", date: "ene. 15, 2024 10:32 am" },
    ]);

    const events = parseInstagramMessages(html, "Ole");

    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].actor).toBe("me");
    expect(events[1].eventType).toBe("message_sent");
    expect(events[1].actor).toBe("me");
  });

  it("handles case-insensitive name matching", () => {
    const html = makeMessageHtml("Chat", [
      { sender: "ole", date: "mar. 01, 2024 2:00 pm" },
    ]);

    const events = parseInstagramMessages(html, "Ole");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_sent");
  });

  it("parses Spanish localized dates correctly", () => {
    const html = makeMessageHtml("Chat", [
      { sender: "User", date: "abr. 14, 2023 9:27 am" },
      { sender: "User", date: "sept. 30, 2024 2:15 pm" },
      { sender: "User", date: "dic. 25, 2023 12:00 pm" },
    ]);

    const events = parseInstagramMessages(html, "User");

    expect(events).toHaveLength(3);

    // April 14, 2023 9:27 AM
    expect(events[0].timestamp.getFullYear()).toBe(2023);
    expect(events[0].timestamp.getMonth()).toBe(3); // April
    expect(events[0].timestamp.getDate()).toBe(14);
    expect(events[0].timestamp.getHours()).toBe(9);

    // September 30, 2024 2:15 PM
    expect(events[1].timestamp.getMonth()).toBe(8); // September
    expect(events[1].timestamp.getHours()).toBe(14);

    // December 25, 2023 12:00 PM
    expect(events[2].timestamp.getMonth()).toBe(11); // December
    expect(events[2].timestamp.getHours()).toBe(12);
  });

  it("extracts conversation name from h1", () => {
    const html = makeMessageHtml("Alice", [
      { sender: "Me", date: "ene. 01, 2024 1:00 pm" },
    ]);

    const events = parseInstagramMessages(html, "Me");
    expect(events[0].participants).toEqual(["Alice"]);
    expect(events[0].metadata.conversationName).toBe("Alice");
  });

  it("sets source to instagram", () => {
    const html = makeMessageHtml("Chat", [
      { sender: "Me", date: "feb. 10, 2024 3:00 pm" },
    ]);

    const events = parseInstagramMessages(html, "Me");
    expect(events[0].source).toBe("instagram");
  });

  it("returns empty array for HTML without messages", () => {
    const html = "<html><body><h1>Empty</h1></body></html>";
    const events = parseInstagramMessages(html, "Me");
    expect(events).toHaveLength(0);
  });

  it("skips messages with unparseable dates", () => {
    const html = makeMessageHtml("Chat", [
      { sender: "Me", date: "invalid date format" },
      { sender: "Me", date: "ene. 01, 2024 1:00 pm" },
    ]);

    const events = parseInstagramMessages(html, "Me");
    expect(events).toHaveLength(1);
  });
});
