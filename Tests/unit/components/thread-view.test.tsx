/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ThreadView } from "@/components/thread-view"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"

const push = jest.fn()
const toast = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}))

jest.mock("@/components/ai-thread-assistant", () => ({
  AiActionStrip: () => <div>AI actions</div>,
  AiThreadAssistant: () => null,
}))

jest.mock("@/components/track-commitment-dialog", () => ({
  TrackCommitmentDialog: () => null,
}))

jest.mock("@/lib/email-api", () => ({
  emailApi: {
    getThread: jest.fn(),
    getAttachment: jest.fn(),
    modifyEmail: jest.fn(),
    saveDraft: jest.fn(),
    sendEmail: jest.fn(),
  },
}))

const api = emailApi as jest.Mocked<typeof emailApi>

const baseEmail: Email = {
  id: "message-1",
  threadId: "thread-1",
  from: { name: "Ada Lovelace", email: "ada@example.com" },
  to: [{ name: "Relay", email: "relay@example.com" }],
  subject: "Quarterly plan",
  body: "",
  bodyPlain: "Please review the attached plan.",
  snippet: "Please review the attached plan.",
  date: "2026-06-13T09:30:00.000Z",
  read: true,
  labels: [],
  provider: "gmail",
  accountId: "account-1",
  accountEmail: "relay@example.com",
}

const mockThread = (email: Email) => {
  api.getThread.mockResolvedValue({
    messages: [email],
    accountId: "account-1",
    accountEmail: "relay@example.com",
    threadId: "thread-1",
  })
}

describe("ThreadView attachment previews", () => {
  beforeEach(() => {
    push.mockReset()
    toast.mockReset()
    jest.clearAllMocks()
  })

  it("previews image attachments from inline attachment data", async () => {
    mockThread({
      ...baseEmail,
      attachments: [
        {
          filename: "chart.png",
          mimeType: "image/png",
          size: 12,
          data: "aW1hZ2UtYnl0ZXM",
        },
      ],
    })

    render(<ThreadView threadId="message-1" />)

    await screen.findByText("chart.png")
    fireEvent.click(screen.getByRole("button", { name: "Preview chart.png" }))

    const image = await screen.findByRole("img", { name: "chart.png" })
    expect(image).toHaveAttribute("src", "data:image/png;base64,aW1hZ2UtYnl0ZXM=")
    expect(api.getAttachment).not.toHaveBeenCalled()
  })

  it("fetches and embeds PDF attachments when previewed", async () => {
    api.getAttachment.mockResolvedValue("JVBERi0xLjQ")
    mockThread({
      ...baseEmail,
      attachments: [
        {
          filename: "agenda.pdf",
          mimeType: "application/pdf",
          size: 2048,
          attachmentId: "attachment-1",
        },
      ],
    })

    render(<ThreadView threadId="message-1" />)

    await screen.findByText("agenda.pdf")
    fireEvent.click(screen.getByRole("button", { name: "Preview agenda.pdf" }))

    await waitFor(() =>
      expect(api.getAttachment).toHaveBeenCalledWith("message-1", "attachment-1"),
    )
    expect(await screen.findByTitle("Preview agenda.pdf")).toHaveAttribute(
      "src",
      "data:application/pdf;base64,JVBERi0xLjQ=",
    )
  })

  it("keeps non-previewable attachments download-only", async () => {
    mockThread({
      ...baseEmail,
      attachments: [
        {
          filename: "notes.txt",
          mimeType: "text/plain",
          size: 64,
          attachmentId: "attachment-text",
        },
      ],
    })

    render(<ThreadView threadId="message-1" />)

    await screen.findByText("notes.txt")
    expect(screen.queryByRole("button", { name: "Preview notes.txt" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download notes.txt" })).toBeInTheDocument()
  })
})
