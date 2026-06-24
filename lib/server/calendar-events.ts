import { google } from 'googleapis';
import { getCalendarAccessToken, createGoogleCalendarOAuthClient, type CalendarConnectionRow } from './calendar-connections';

export type CalendarEventInput = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  reminderMinutes: number;
  attendees?: string[];
  location?: string;
  createConference?: boolean;
};

export type CalendarEventUpdateInput = Partial<Omit<CalendarEventInput, 'reminderMinutes'>> & {
  reminderMinutes?: number;
};

export async function createProviderCalendarEvent(connection: CalendarConnectionRow, input: CalendarEventInput) {
  const token = await getCalendarAccessToken(connection);
  if (connection.provider === 'gmail') {
    const auth = createGoogleCalendarOAuthClient();
    auth.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: connection.default_calendar_id || 'primary',
      conferenceDataVersion: input.createConference ? 1 : undefined,
      sendUpdates: input.attendees?.length ? 'all' : 'none',
      requestBody: {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: { dateTime: input.startsAt, timeZone: input.timezone },
        end: { dateTime: input.endsAt, timeZone: input.timezone },
        attendees: input.attendees?.map((email) => ({ email })),
        conferenceData: input.createConference
          ? {
              createRequest: {
                requestId: `relay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: input.reminderMinutes }] },
      },
    });
    if (!response.data.id) throw new Error('Google Calendar did not return an event id');
    return {
      eventId: response.data.id,
      calendarId: connection.default_calendar_id || 'primary',
      htmlLink: response.data.htmlLink || null,
      meetingUrl: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || null,
    };
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: input.title,
      body: { contentType: 'text', content: input.description || '' },
      start: { dateTime: input.startsAt, timeZone: input.timezone || 'UTC' },
      end: { dateTime: input.endsAt, timeZone: input.timezone || 'UTC' },
      location: input.location ? { displayName: input.location } : undefined,
      attendees: input.attendees?.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      isOnlineMeeting: input.createConference || undefined,
      onlineMeetingProvider: input.createConference ? 'teamsForBusiness' : undefined,
      isReminderOn: true,
      reminderMinutesBeforeStart: input.reminderMinutes,
    }),
  });
  const event = await response.json() as {
    id?: string;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
    error?: { message?: string };
  };
  if (!response.ok || !event.id) throw new Error(event.error?.message || 'Microsoft Calendar event creation failed');
  return {
    eventId: event.id,
    calendarId: connection.default_calendar_id || 'primary',
    htmlLink: event.webLink || null,
    meetingUrl: event.onlineMeeting?.joinUrl || null,
  };
}

export type CalendarAgendaEvent = {
  id: string;
  accountId: string;
  provider: CalendarConnectionRow['provider'];
  calendarId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  location?: string | null;
  attendees: string[];
  htmlLink?: string | null;
  meetingUrl?: string | null;
};

export async function listProviderCalendarEvents(
  connection: CalendarConnectionRow,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarAgendaEvent[]> {
  const token = await getCalendarAccessToken(connection);
  if (connection.provider === 'gmail') {
    const auth = createGoogleCalendarOAuthClient();
    auth.setCredentials({ access_token: token });
    const calendarId = connection.default_calendar_id || 'primary';
    const response = await google.calendar({ version: 'v3', auth }).events.list({
      calendarId,
      timeMin: rangeStart,
      timeMax: rangeEnd,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    return (response.data.items || [])
      .filter((event) => event.id && event.status !== 'cancelled')
      .map((event) => ({
        id: event.id!,
        accountId: connection.account_id,
        provider: connection.provider,
        calendarId,
        title: event.summary || '(No title)',
        description: event.description || null,
        startsAt: event.start?.dateTime || event.start?.date || rangeStart,
        endsAt: event.end?.dateTime || event.end?.date || event.start?.dateTime || event.start?.date || rangeStart,
        timezone: event.start?.timeZone || null,
        location: event.location || null,
        attendees: (event.attendees || []).map((attendee) => attendee.email || '').filter(Boolean),
        htmlLink: event.htmlLink || null,
        meetingUrl: event.hangoutLink || event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || null,
      }));
  }

  const params = new URLSearchParams({
    startDateTime: rangeStart,
    endDateTime: rangeEnd,
    '$top': '250',
    '$orderby': 'start/dateTime',
    '$select': 'id,subject,bodyPreview,start,end,location,attendees,webLink,onlineMeeting',
  });
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  const payload = await response.json().catch(() => ({})) as {
    value?: Array<{
      id?: string;
      subject?: string;
      bodyPreview?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      location?: { displayName?: string };
      attendees?: Array<{ emailAddress?: { address?: string } }>;
      webLink?: string;
      onlineMeeting?: { joinUrl?: string };
    }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || 'Microsoft Calendar event listing failed');
  return (payload.value || []).filter((event) => event.id).map((event) => ({
    id: event.id!,
    accountId: connection.account_id,
    provider: connection.provider,
    calendarId: connection.default_calendar_id || 'primary',
    title: event.subject || '(No title)',
    description: event.bodyPreview || null,
    startsAt: event.start?.dateTime || rangeStart,
    endsAt: event.end?.dateTime || event.start?.dateTime || rangeStart,
    timezone: event.start?.timeZone || null,
    location: event.location?.displayName || null,
    attendees: (event.attendees || []).map((attendee) => attendee.emailAddress?.address || '').filter(Boolean),
    htmlLink: event.webLink || null,
    meetingUrl: event.onlineMeeting?.joinUrl || null,
  }));
}

export async function deleteProviderCalendarEvent(
  connection: CalendarConnectionRow,
  calendarId: string,
  eventId: string,
) {
  const token = await getCalendarAccessToken(connection);
  if (connection.provider === 'gmail') {
    const auth = createGoogleCalendarOAuthClient();
    auth.setCredentials({ access_token: token });
    await google.calendar({ version: 'v3', auth }).events.delete({ calendarId, eventId });
    return;
  }
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new Error('Microsoft Calendar event deletion failed');
}

export async function updateProviderCalendarEvent(
  connection: CalendarConnectionRow,
  calendarId: string,
  eventId: string,
  input: CalendarEventUpdateInput,
) {
  const token = await getCalendarAccessToken(connection);
  if (connection.provider === 'gmail') {
    const auth = createGoogleCalendarOAuthClient();
    auth.setCredentials({ access_token: token });
    const response = await google.calendar({ version: 'v3', auth }).events.patch({
      calendarId,
      eventId,
      conferenceDataVersion: input.createConference ? 1 : undefined,
      sendUpdates: input.attendees?.length ? 'all' : 'none',
      requestBody: {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: input.startsAt ? { dateTime: input.startsAt, timeZone: input.timezone || 'UTC' } : undefined,
        end: input.endsAt ? { dateTime: input.endsAt, timeZone: input.timezone || 'UTC' } : undefined,
        attendees: input.attendees?.map((email) => ({ email })),
        reminders: typeof input.reminderMinutes === 'number'
          ? { useDefault: false, overrides: [{ method: 'popup', minutes: input.reminderMinutes }] }
          : undefined,
      },
    });
    return {
      eventId,
      calendarId,
      htmlLink: response.data.htmlLink || null,
      meetingUrl: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || null,
    };
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: input.title,
      body: input.description === undefined ? undefined : { contentType: 'text', content: input.description },
      start: input.startsAt ? { dateTime: input.startsAt, timeZone: input.timezone || 'UTC' } : undefined,
      end: input.endsAt ? { dateTime: input.endsAt, timeZone: input.timezone || 'UTC' } : undefined,
      location: input.location === undefined ? undefined : { displayName: input.location },
      attendees: input.attendees?.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      isReminderOn: typeof input.reminderMinutes === 'number' ? true : undefined,
      reminderMinutesBeforeStart: input.reminderMinutes,
    }),
  });
  const event = await response.json().catch(() => ({})) as {
    id?: string;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(event.error?.message || 'Microsoft Calendar event update failed');
  return {
    eventId,
    calendarId,
    htmlLink: event.webLink || null,
    meetingUrl: event.onlineMeeting?.joinUrl || null,
  };
}
