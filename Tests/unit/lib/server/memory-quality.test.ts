import {
  canonicalMemoryText,
  containsSensitiveMemoryText,
  meetsMemoryConfidenceThreshold,
  memoryFingerprint,
} from "@/lib/server/memory-quality";

describe("memory quality helpers", () => {
  it("canonicalizes memory text before fingerprinting", () => {
    expect(canonicalMemoryText("User prefers short email replies.")).toBe("short");
    expect(memoryFingerprint({ type: "style", text: "User prefers short email replies." }))
      .toBe(memoryFingerprint({ type: "style", text: "Prefers short replies" }));
  });

  it("uses memory-type confidence thresholds", () => {
    expect(meetsMemoryConfidenceThreshold("style", 0.55)).toBe(true);
    expect(meetsMemoryConfidenceThreshold("preference", 0.55)).toBe(false);
    expect(meetsMemoryConfidenceThreshold("fact", 0.74)).toBe(false);
    expect(meetsMemoryConfidenceThreshold("fact", 0.75)).toBe(true);
  });

  it("rejects obvious sensitive memory text", () => {
    expect(containsSensitiveMemoryText("My OTP is 123456")).toBe(true);
    expect(containsSensitiveMemoryText("Use reset link https://example.com/reset?token=abc")).toBe(true);
    expect(containsSensitiveMemoryText("Keep replies short and direct")).toBe(false);
  });
});
