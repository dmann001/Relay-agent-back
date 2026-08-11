import {
  formatEmailContent,
  formatFileSize,
  formatMailboxTimestamp,
  htmlToPlainText,
  isHTML,
  sanitizeEmailHTML,
} from "@/lib/email-utils";

jest.mock("dompurify", () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => html,
  },
}));

describe("email utilities", () => {
  describe("sanitizeEmailHTML", () => {
    it("handles empty, escaped, and structurally empty HTML", () => {
      expect(sanitizeEmailHTML("")).toBe("");
      expect(
        sanitizeEmailHTML("&amp;lt;p&amp;gt;Tom &amp;amp; Ada&amp;lt;/p&amp;gt;"),
      ).toBe("<p>Tom & Ada</p>");
      expect(
        sanitizeEmailHTML(
          "<table><tbody></tbody></table><center></center><div><br></div><br><br><br>",
        ),
      ).toBe("<br><br>");
    });

    it("uses a browser decoder when document is available", () => {
      const originalDocument = global.document;
      const textarea = { innerHTML: "", value: "decoded" };
      Object.defineProperty(global, "document", {
        configurable: true,
        value: { createElement: jest.fn(() => textarea) },
      });

      expect(sanitizeEmailHTML("plain &copy; text")).toBe("decoded");
      Object.defineProperty(global, "document", {
        configurable: true,
        value: originalDocument,
      });
    });

    it("continues with the original content if browser decoding fails", () => {
      const originalDocument = global.document;
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      Object.defineProperty(global, "document", {
        configurable: true,
        value: { createElement: jest.fn(() => { throw new Error("decoder failed"); }) },
      });

      expect(sanitizeEmailHTML("plain text")).toBe("plain text");
      expect(warn).toHaveBeenCalledWith("HTML entity decoding failed:", expect.any(Error));
      warn.mockRestore();
      Object.defineProperty(global, "document", {
        configurable: true,
        value: originalDocument,
      });
    });

    it("caps repeated structural cleanup at ten passes", () => {
      const nested = `${"<div>".repeat(11)}${"</div>".repeat(11)}`;
      expect(sanitizeEmailHTML(nested)).toBe("<div></div>");
    });
  });

  describe("htmlToPlainText", () => {
    it("removes tags, decodes entities, and normalizes whitespace", () => {
      expect(htmlToPlainText("<p>Hello&nbsp; &amp; goodbye</p>")).toBe(
        "Hello & goodbye",
      );
    });

    it("returns an empty string for empty input", () => {
      expect(htmlToPlainText("")).toBe("");
    });
  });

  describe("isHTML", () => {
    it.each([
      ["<p>Hello</p>", true],
      ["&lt;p&gt;Hello&lt;/p&gt;", true],
      ["&amp;lt;article&amp;gt;Hello&amp;lt;/article&amp;gt;", true],
      ["prefix &lt;br suffix", true],
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

    it("handles every fallback source and malformed marketing markup", () => {
      expect(formatEmailContent("", "&lt;p&gt;Fallback&lt;/p&gt;")).toEqual({
        html: "<p>Fallback</p>",
        isHtml: true,
      });
      expect(formatEmailContent("", "")).toEqual({ html: "", isHtml: false });
      expect(formatEmailContent("<a https://example.com", "x")).toEqual({
        html: "<a https://example.com",
        isHtml: true,
      });
      expect(formatEmailContent("Visit https://example.com for details", "Plain")).toEqual({
        html: "Plain",
        isHtml: false,
      });
      expect(formatEmailContent("Plain body", "&lt;strong&gt;HTML fallback&lt;/strong&gt;")).toEqual({
        html: "<strong>HTML fallback</strong>",
        isHtml: true,
      });
      expect(formatEmailContent("Plain body")).toEqual({
        html: "Plain body",
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
  const now = new Date(2026, 5, 13, 12, 0, 0)

  const atLocalTime = (year: number, monthIndex: number, day: number) =>
    new Date(year, monthIndex, day, 9, 30, 0).toISOString()

  it("uses time, yesterday, weekday, and dated formats for mailbox scanning", () => {
    const today = new Date(2026, 5, 13, 9, 30, 0)

    expect(formatMailboxTimestamp(atLocalTime(2026, 5, 13), now)).toBe(
      today.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    )
    expect(formatMailboxTimestamp(atLocalTime(2026, 5, 12), now)).toBe("Yesterday")
    expect(formatMailboxTimestamp(atLocalTime(2026, 5, 10), now)).toMatch(/Wed/)
    expect(formatMailboxTimestamp(atLocalTime(2025, 4, 18), now)).toMatch(/2025/)
    expect(formatMailboxTimestamp(atLocalTime(2026, 4, 18), now)).not.toMatch(/2026/)
    expect(formatMailboxTimestamp(atLocalTime(2026, 6, 18), now)).not.toMatch(/2026/)
  })

  it("returns an empty label for invalid dates", () => {
    expect(formatMailboxTimestamp("invalid", now)).toBe("")
    expect(formatMailboxTimestamp(new Date().toISOString())).not.toBe("")
  })
})
