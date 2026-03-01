import { describe, it, expect } from "vitest";
import { parseMboxStreaming, type MboxBatch } from "@/parsers/google/mbox-stream";

function makeMboxFile(content: string): File {
  return new File([content], "test.mbox", { type: "application/mbox" });
}

async function collectBatches(
  gen: AsyncGenerator<MboxBatch>,
) {
  const events: import("@/parsers/types").MetadataEvent[] = [];
  const aggregates: import("@/parsers/types").DailyAggregate[] = [];
  for await (const batch of gen) {
    events.push(...batch.events);
    aggregates.push(...batch.aggregates);
  }
  return { events, aggregates };
}

describe("parseMboxStreaming", () => {
  it("detects user email and classifies sent/received", async () => {
    // Build an mbox where user@me.com appears most frequently as sender
    const emails: string[] = [];
    // 6 sent emails from user
    for (let i = 0; i < 6; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 08:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Sent ${i}

Body ${i}`,
      );
    }
    // 3 received emails from different senders
    for (let i = 0; i < 3; i++) {
      emails.push(
        `From other${i}@example.com Mon Jan 0${i + 1} 09:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 09:00:00 +0000
From: other${i}@example.com
To: user@me.com
Subject: Received ${i}

Body ${i}`,
      );
    }

    const mbox = emails.join("\n\n");
    const { events, aggregates } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    // Sent emails should be individual events
    const sentEvents = events.filter((e) => e.eventType === "message_sent");
    expect(sentEvents.length).toBe(6);
    expect(sentEvents[0].actor).toBe("user@me.com");
    expect(sentEvents[0].metadata.direction).toBe("sent");

    // Received emails should be in daily aggregates (not individual events unless they're replies)
    // Since these received emails don't have In-Reply-To matching a sent Message-ID,
    // they should only appear as aggregates
    const receivedEvents = events.filter((e) => e.eventType === "message_received");
    expect(receivedEvents.length).toBe(0); // No matching In-Reply-To

    // Daily aggregates should contain the received emails
    const totalAggregatedReceived = aggregates.reduce((sum, a) => sum + a.count, 0);
    expect(totalAggregatedReceived).toBe(3);
  });

  it("extracts Message-ID and In-Reply-To headers", async () => {
    const mbox = `From user@me.com Mon Jan 01 08:00:00 2024
Date: Mon, 01 Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Original
Message-ID: <msg001@mail.gmail.com>

Body

From user@me.com Mon Jan 01 09:00:00 2024
Date: Mon, 01 Jan 2024 09:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Reply
Message-ID: <msg002@mail.gmail.com>
In-Reply-To: <msg001@mail.gmail.com>

Body
`;
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));
    expect(events.length).toBeGreaterThanOrEqual(2);
    const firstSent = events.find((e) => e.metadata.messageId === "msg001@mail.gmail.com");
    expect(firstSent).toBeDefined();
    const reply = events.find((e) => e.metadata.inReplyTo === "msg001@mail.gmail.com");
    expect(reply).toBeDefined();
  });

  it("parses a single email (all same sender = all sent)", async () => {
    const mbox = `From sender@example.com Sat Jan 01 12:00:00 2024
Date: Sat, 01 Jan 2024 12:00:00 +0000
From: sender@example.com
To: recipient@example.com
Subject: Hello World

This is the body.
`;
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("sender@example.com");
    expect(events[0].participants).toEqual(["recipient@example.com"]);
    expect(events[0].metadata.hasSubject).toBe(true);
    expect(events[0].metadata.subjectLength).toBe(11);
  });

  it("handles folded headers", async () => {
    const mbox = `From sender@example.com Sat Jan 01 12:00:00 2024
Date: Sat, 01 Jan 2024 12:00:00 +0000
From: "Very Long Name"
 <sender@example.com>
To: recipient@example.com
Subject: Folded

Body
`;
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("sender@example.com");
  });

  it("extracts email from angle brackets", async () => {
    const mbox = `From test@x.com Mon Jan 01 10:00:00 2024
Date: Mon, 01 Jan 2024 10:00:00 +0000
From: John Doe <john@example.com>
To: Jane Smith <jane@example.com>
Subject: Test

Body
`;
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("john@example.com");
    expect(events[0].participants).toEqual(["jane@example.com"]);
  });

  it("skips emails without Date header", async () => {
    const mbox = `From nope@test.com Mon Jan 01 10:00:00 2024
From: nope@test.com
To: someone@test.com
Subject: No date

Body
`;
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));
    expect(events).toHaveLength(0);
  });

  it("filters mailing list addresses from sent-email participants", async () => {
    const emails: string[] = [];
    // 6 sent emails from user to a friend (no List-Id)
    for (let i = 0; i < 6; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 08:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: To friend ${i}

Body ${i}`,
      );
    }
    // 3 received list emails (with List-Id) — different real senders via the list
    for (let i = 0; i < 3; i++) {
      emails.push(
        `From listperson${i}@example.com Mon Jan 0${i + 1} 09:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 09:00:00 +0000
From: listperson${i}@example.com
To: list@mlm.example.org
Subject: List msg ${i}
List-Id: My List <list.mlm.example.org>

Body ${i}`,
      );
    }
    // 2 sent-to-list emails (user sends to the list address)
    for (let i = 0; i < 2; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 10:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 10:00:00 +0000
From: user@me.com
To: list@mlm.example.org
Subject: To list ${i}

Body ${i}`,
      );
    }

    const mbox = emails.join("\n\n");
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    const sentEvents = events.filter((e) => e.eventType === "message_sent");
    // 6 to friend + 2 to list = 8 sent events total
    expect(sentEvents.length).toBe(8);

    // The 6 sent-to-friend events should have the friend as participant
    const toFriend = sentEvents.filter((e) => e.participants.includes("friend@example.com"));
    expect(toFriend.length).toBe(6);

    // The 2 sent-to-list events should have empty participants (list address filtered)
    const toList = sentEvents.filter((e) => e.participants.length === 0);
    expect(toList.length).toBe(2);
  });

  it("excludes list From: addresses from user email detection", async () => {
    const emails: string[] = [];
    // 5 emails from the real user
    for (let i = 0; i < 5; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 08:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Sent ${i}

Body ${i}`,
      );
    }
    // 10 list emails — more frequent From: address, but all have List-Id
    for (let i = 0; i < 10; i++) {
      const day = String(i + 1).padStart(2, "0");
      emails.push(
        `From listbot@lists.example.org Mon Jan ${day} 09:00:00 2024
Date: Mon, ${day} Jan 2024 09:00:00 +0000
From: listbot@lists.example.org
To: list@lists.example.org
Subject: Digest ${i}
List-Id: Digest <digest.lists.example.org>

Body ${i}`,
      );
    }

    const mbox = emails.join("\n\n");
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    // user@me.com should be detected as the user (not listbot@lists.example.org)
    const sentEvents = events.filter((e) => e.eventType === "message_sent");
    expect(sentEvents.length).toBe(5);
    expect(sentEvents[0].actor).toBe("user@me.com");
  });

  it("excludes user's own email from participants in self-addressed sent mail", async () => {
    const emails: string[] = [];
    // 6 sent emails from user to a friend (establishes user@me.com as the user)
    for (let i = 0; i < 6; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 08:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: To friend ${i}

Body ${i}`,
      );
    }
    // 1 self-addressed email (user emails themselves)
    emails.push(
      `From user@me.com Mon Jan 08 08:00:00 2024
Date: Mon, 08 Jan 2024 08:00:00 +0000
From: user@me.com
To: user@me.com
Subject: Note to self

Body`,
    );

    const mbox = emails.join("\n\n");
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    const sentEvents = events.filter((e) => e.eventType === "message_sent");
    expect(sentEvents.length).toBe(7);

    // The self-addressed email should have empty participants (user's own email filtered out)
    const selfEmail = sentEvents.find((e) => e.metadata.hasSubject && e.participants.length === 0);
    expect(selfEmail).toBeDefined();

    // No sent event should have user@me.com as a participant
    for (const e of sentEvents) {
      expect(e.participants).not.toContain("user@me.com");
    }
  });

  it("uses sender (not recipient) as participant for received replies", async () => {
    const emails: string[] = [];
    // 6 sent emails from user (establishes user@me.com as the user)
    for (let i = 0; i < 6; i++) {
      emails.push(
        `From user@me.com Mon Jan 0${i + 1} 08:00:00 2024
Date: Mon, 0${i + 1} Jan 2024 08:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Sent ${i}
Message-ID: <sent${i}@mail.gmail.com>

Body ${i}`,
      );
    }
    // 1 received reply (In-Reply-To matches a sent Message-ID)
    emails.push(
      `From friend@example.com Mon Jan 08 09:00:00 2024
Date: Mon, 08 Jan 2024 09:00:00 +0000
From: friend@example.com
To: user@me.com
Subject: Re: Sent 0
Message-ID: <reply1@mail.gmail.com>
In-Reply-To: <sent0@mail.gmail.com>

Body reply`,
    );

    const mbox = emails.join("\n\n");
    const { events } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    const receivedEvents = events.filter((e) => e.eventType === "message_received");
    expect(receivedEvents.length).toBe(1);

    // Participant should be the sender (friend@example.com), not the user's own email
    expect(receivedEvents[0].participants).toEqual(["friend@example.com"]);
    expect(receivedEvents[0].participants).not.toContain("user@me.com");
  });

  it("reports progress", async () => {
    const mbox = `From a@test.com Mon Jan 01 08:00:00 2024
Date: Mon, 01 Jan 2024 08:00:00 +0000
From: a@test.com
Subject: Test

Body
`;
    const progressCalls: [number, number][] = [];
    await collectBatches(
      parseMboxStreaming(makeMboxFile(mbox), (read, total) => {
        progressCalls.push([read, total]);
      }),
    );
    expect(progressCalls.length).toBeGreaterThan(0);
    const last = progressCalls[progressCalls.length - 1];
    expect(last[0]).toBe(last[1]);
  });

  it("generates daily aggregates for received emails", async () => {
    // User is the most frequent sender
    const emails: string[] = [];
    // 4 sent from user
    for (let i = 0; i < 4; i++) {
      emails.push(
        `From user@me.com Mon Jan 15 0${8 + i}:00:00 2024
Date: Mon, 15 Jan 2024 0${8 + i}:00:00 +0000
From: user@me.com
To: friend@example.com
Subject: Sent ${i}

Body`,
      );
    }
    // 2 received on same day
    for (let i = 0; i < 2; i++) {
      emails.push(
        `From contact${i}@example.com Mon Jan 15 1${i}:00:00 2024
Date: Mon, 15 Jan 2024 1${i}:00:00 +0000
From: contact${i}@example.com
To: user@me.com
Subject: Incoming ${i}

Body`,
      );
    }

    const mbox = emails.join("\n\n");
    const { aggregates } = await collectBatches(parseMboxStreaming(makeMboxFile(mbox)));

    // Should have aggregates for received emails
    const totalReceived = aggregates.reduce((sum, a) => sum + a.count, 0);
    expect(totalReceived).toBe(2);

    // Check aggregate structure
    if (aggregates.length > 0) {
      expect(aggregates[0].source).toBe("google");
      expect(aggregates[0].category).toBe("gmail-received");
      expect(aggregates[0].hourlyDistribution).toHaveLength(24);
      expect(aggregates[0].topParticipants.length).toBeGreaterThan(0);
    }
  });
});
