/**
 * @jest-environment node
 */
const getSession = jest.fn()

jest.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSession(...args) } },
}))

import { emailApi } from "@/lib/email-api"

const response = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue(payload),
})

describe("email API outside a browser", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    })
    global.fetch = jest.fn().mockResolvedValue(response({
      results: [],
      event: {},
      monitor: {},
      brief: {},
      activity: {},
      commitment: {},
    }))
  })

  it("performs event-producing mutations without requiring window", async () => {
    await emailApi.sync()
    await emailApi.modifyEmail("message-1", "archive")
    await emailApi.sendEmail({ to: [], subject: "Subject", body: "Body" })
    await emailApi.saveDraft({ to: [], subject: "Subject", body: "Body" })
    await emailApi.deleteDraft("draft-1")
    await emailApi.disconnectAccount("account-1")
    await emailApi.createCalendarMeeting({
      title: "Meeting",
      startsAt: "2026-08-12T10:00:00Z",
      endsAt: "2026-08-12T10:30:00Z",
      timezone: "UTC",
    })
    await emailApi.updateCalendarMeeting("event-1", {
      accountId: "account-1",
      calendarId: "primary",
      title: "Meeting",
      startsAt: "2026-08-12T10:00:00Z",
      endsAt: "2026-08-12T10:30:00Z",
      timezone: "UTC",
    })
    await emailApi.deleteCalendarMeeting({ id: "event-1", accountId: "account-1", calendarId: "primary" })
    await emailApi.createCommitmentCalendarEvent("commitment-1")
    await emailApi.deleteCommitmentCalendarEvent("event-1")
    await emailApi.enableCommitmentMonitor("commitment-1")
    await emailApi.prepareMeetingBrief("commitment-1")
    await emailApi.controlAgentActivity("activity-1", "cancel")
    await emailApi.createCommitment({
      accountId: "account-1",
      providerMessageId: "message-1",
      type: "my_task",
      title: "Reply",
    })
    await emailApi.updateCommitment("commitment-1", { action: "dismiss" })

    expect(global.fetch).toHaveBeenCalledTimes(16)
  })
})
