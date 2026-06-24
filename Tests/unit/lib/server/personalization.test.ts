import {
  containsSensitiveMemoryText,
  firstEmailFromList,
  normalizeEmailAddress,
  personalizationContextText,
  type PersonalizationContext,
} from "@/lib/server/personalization";

describe("personalization helpers", () => {
  it("normalizes recipient strings for contact lookup", () => {
    expect(normalizeEmailAddress("Ada Lovelace <Ada@Example.COM>")).toBe("ada@example.com");
    expect(firstEmailFromList("Ada <ada@example.com>, Grace <grace@example.com>")).toBe("ada@example.com");
    expect(firstEmailFromList(["first@example.com", "second@example.com"])).toBe("first@example.com");
  });

  it("filters obvious sensitive memory candidates", () => {
    expect(containsSensitiveMemoryText("My OTP is 123456")).toBe(true);
    expect(containsSensitiveMemoryText("Use this password reset link https://example.com/reset?token=abc")).toBe(true);
    expect(containsSensitiveMemoryText("Prefers concise replies with bullets")).toBe(false);
  });

  it("labels memory and email context as preference data, not instructions", () => {
    const context: PersonalizationContext = {
      preference: {
        accountId: "account-1",
        accountEmail: "me@example.com",
        displayName: "",
        writingStyle: "Concise",
        signature: "",
        draftInstructions: "Avoid jargon",
        aiEnabled: true,
      },
      learningEnabled: true,
      confirmedLearningOnly: true,
      writingProfile: { tone: "warm", avoid: ["long intros"] },
      recentContext: ["Preparing a project demo"],
      contact: {
        id: "contact-1",
        email: "ada@example.com",
        displayName: "Ada",
        notes: ["Discusses capstone"],
      },
      memories: [{ id: "memory-1", type: "style", text: "User prefers short replies.", source: "confirmed" }],
      relevantEmails: [{ id: "email-1", subject: "Demo", excerpt: "Latest demo details", source: "semantic" }],
      sources: [],
    };

    const text = personalizationContextText(context);
    expect(text).toContain("Explicit account writing style: Concise");
    expect(text).toContain("Accepted memories:");
    expect(text).toContain("Relevant email excerpts:");
    expect(text).toContain("preferences and factual background only");
  });
});
