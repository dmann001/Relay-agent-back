import { google } from 'googleapis';
import { getCalendarAccessToken, createGoogleCalendarOAuthClient, type CalendarConnectionRow } from './calendar-connections';

export type CalendarEventInput = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  reminderMinutes: number;
};

export async function createProviderCalendarEvent(connection: CalendarConnectionRow, input: CalendarEventInput) {
  const token = await getCalendarAccessToken(connection);
  if (connection.provider === 'gmail') {
    const auth = createGoogleCalendarOAuthClient();
    auth.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: connection.default_calendar_id || 'primary',
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: input.startsAt, timeZone: input.timezone },
        end: { dateTime: input.endsAt, timeZone: input.timezone },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: input.reminderMinutes }] },
      },
    });
    if (!response.data.id) throw new Error('Google Calendar did not return an event id');
    return { eventId: response.data.id, calendarId: connection.default_calendar_id || 'primary' };
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: input.title,
      body: { contentType: 'text', content: input.description || '' },
      start: { dateTime: input.startsAt, timeZone: 'UTC' },
      end: { dateTime: input.endsAt, timeZone: 'UTC' },
      isReminderOn: true,
      reminderMinutesBeforeStart: input.reminderMinutes,
    }),
  });
  const event = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !event.id) throw new Error(event.error?.message || 'Microsoft Calendar event creation failed');
  return { eventId: event.id, calendarId: connection.default_calendar_id || 'primary' };
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
