import { buildRawMessage, parseMessageMetadata } from "@/lib/server/gmail-api";

describe("core email performance budgets", () => {
  it("parses 2,000 cached Gmail metadata records within a generous CI budget", () => {
    const message = {
      id: "message-1",
      threadId: "thread-1",
      internalDate: "1710000000000",
      labelIds: ["INBOX", "UNREAD", "CATEGORY_PRIMARY"],
      snippet: "Hello &amp; welcome",
      payload: {
        headers: [
          { name: "From", value: "Sender <sender@example.com>" },
          { name: "To", value: "User <user@example.com>" },
          { name: "Subject", value: "Performance test" },
        ],
      },
    };
    const startedAt = performance.now();

    for (let index = 0; index < 2_000; index += 1) {
      parseMessageMetadata(message);
    }

    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });

  it("encodes a 512 KB attachment within a generous CI budget", () => {
    const data = Buffer.alloc(512 * 1024, "a").toString("base64");
    const startedAt = performance.now();

    const raw = buildRawMessage({
      to: ["recipient@example.com"],
      subject: "Large attachment",
      body: "Attached",
      attachments: [{ filename: "large.txt", mimeType: "text/plain", data }],
    });

    expect(raw.length).toBeGreaterThan(data.length);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });
});
