/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import { AiChatMarkdown } from "@/components/ai-chat-markdown"

describe("AiChatMarkdown", () => {
  it("renders bold markdown", () => {
    render(<AiChatMarkdown content="Price is **$195.13** today." />)
    const strong = screen.getByText("$195.13")
    expect(strong.tagName).toBe("STRONG")
  })

  it("renders paragraphs and line breaks", () => {
    render(<AiChatMarkdown content={"First line\nSecond line\n\nNew paragraph."} />)
    expect(screen.getByText("New paragraph.")).toBeInTheDocument()
  })

  it("renders generated image markdown", () => {
    render(<AiChatMarkdown content="![Generated image](data:image/png;base64,abc123)" />)
    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", "data:image/png;base64,abc123")
  })
})
