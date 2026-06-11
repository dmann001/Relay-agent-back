import {
  formatEmailContent,
  formatFileSize,
  htmlToPlainText,
  isHTML,
} from "./email-utils";

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
