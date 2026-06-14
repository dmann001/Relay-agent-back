import {
  formatEmailContent,
  formatFileSize,
  htmlToPlainText,
  isHTML,
} from "@/lib/email-utils";

jest.mock("dompurify", () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => html,
  },
}));

describe("email utilities", () => {
  describe("htmlToPlainText", () => {
    it("removes tags, decodes entities, and normalizes whitespace", () => {
      expect(htmlToPlainText("<p>Hello&nbsp; &amp; goodbye</p>")).toBe(
        "Hello & goodbye",
      );
    });
  });

  describe("isHTML", () => {
    it.each([
      ["<p>Hello</p>", true],
      ["&lt;p&gt;Hello&lt;/p&gt;", true],
      ["Plain email text", false],
      ["", false],
    ])("classifies %j as HTML=%s", (content, expected) => {
      expect(isHTML(content)).toBe(expected);
    });
  });

  describe("formatEmailContent", () => {
    it("prefers sanitized HTML when the body contains markup", () => {
      expect(formatEmailContent("<p>Hello</p>", "Hello")).toEqual({
        html: "<p>Hello</p>",
        isHtml: true,
      });
    });

    it("uses the plain-text fallback when the body is empty", () => {
      expect(formatEmailContent("", "Plain fallback")).toEqual({
        html: "Plain fallback",
        isHtml: false,
      });
    });
  });

  describe("formatFileSize", () => {
    it.each([
      [0, "0 Bytes"],
      [1024, "1 KB"],
      [1536, "1.5 KB"],
      [1048576, "1 MB"],
    ])("formats %i bytes as %s", (bytes, expected) => {
      expect(formatFileSize(bytes)).toBe(expected);
    });
  });
});

describe("formatMailboxTimestamp", () => {
  const { formatMailboxTimestamp } = jest.requireActual("@/lib/email-utils")
  const now = new Date("2026-06-13T12:00:00.000Z")

  it("uses time, yesterday, weekday, and dated formats for mailbox scanning", () => {
    expect(formatMailboxTimestamp("2026-06-13T09:30:00.000Z", now)).toMatch(/9:30/)
    expect(formatMailboxTimestamp("2026-06-12T09:30:00.000Z", now)).toBe("Yesterday")
    expect(formatMailboxTimestamp("2026-06-10T09:30:00.000Z", now)).toMatch(/Wed/)
    expect(formatMailboxTimestamp("2025-05-18T09:30:00.000Z", now)).toMatch(/2025/)
  })

  it("returns an empty label for invalid dates", () => {
    expect(formatMailboxTimestamp("invalid", now)).toBe("")
  })
})
