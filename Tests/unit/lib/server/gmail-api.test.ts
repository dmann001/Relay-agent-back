const mockGmailApi = {
  users: {
    messages: {
      list: jest.fn(),
      get: jest.fn(),
      modify: jest.fn(),
      trash: jest.fn(),
      untrash: jest.fn(),
      send: jest.fn(),
      attachments: { get: jest.fn() },
    },
    history: { list: jest.fn() },
    threads: { get: jest.fn() },
    getProfile: jest.fn(),
    drafts: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      send: jest.fn(),
    },
  },
};

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => mockGmailApi),
    auth: { OAuth2: jest.fn() },
  },
}));

import {
  buildRawMessage,
  createDraft,
  deleteDraft,
  fetchFullMessage,
  fetchFullThread,
  fetchMessageMetadataBatch,
  formatOutgoingBodyAsHtml,
  getAttachment,
  getProfileHistoryId,
  listDrafts,
  listHistoryDelta,
  listMessageIds,
  listMessageIdsPage,
  modifyMessage,
  parseMessageMetadata,
  sendDraft,
  sendMessage,
  trashMessage,
  untrashMessage,
  updateDraft,
} from '@/lib/server/gmail-api';

describe('Gmail MIME generation', () => {
  it('includes attachment content when building a multipart message', () => {
    const fileBytes = Buffer.from('attachment contents');
    const raw = buildRawMessage({
      to: ['recipient@example.com'],
      subject: 'Attachment test',
      body: 'See attached.',
      attachments: [{
        filename: 'report.txt',
        mimeType: 'text/plain',
        data: fileBytes.toString('base64'),
      }],
    });

    const mime = Buffer.from(
      raw.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');

    expect(mime).toContain('Content-Type: multipart/mixed;');
    expect(mime).toContain('Content-Type: text/plain; name="report.txt"');
    expect(mime).toContain('Content-Disposition: attachment; filename="report.txt"');
    expect(mime).toContain(fileBytes.toString('base64'));
    expect(mime).toContain('\r\n');
  });

  it('escapes plain text and strips header injection characters', () => {
    const raw = buildRawMessage({
      to: ['recipient@example.com'],
      subject: 'Plain body',
      body: '<unsafe & text',
      attachments: [{
        filename: 'report"\r\nBcc: attacker@example.com.txt',
        mimeType: 'text/plain\r\nX-Injected: true',
        data: Buffer.from('safe').toString('base64'),
      }],
    });
    const mime = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .toString('utf8');

    expect(mime).toContain('&lt;unsafe &amp; text');
    expect(mime).not.toContain('\r\nBcc: attacker@example.com');
    expect(mime).not.toContain('\r\nX-Injected: true');
  });

  it('preserves HTML and emits copy and reply headers with safe MIME defaults', () => {
    expect(formatOutgoingBodyAsHtml('<strong>Already HTML</strong>')).toBe(
      '<strong>Already HTML</strong>',
    );
    expect(formatOutgoingBodyAsHtml('First\r\nline\r\n\r\nSecond')).toBe(
      '<p>First<br />line</p><p>Second</p>',
    );
    const raw = buildRawMessage({
      to: ['recipient@example.com'],
      cc: ['copy@example.com'],
      subject: 'Reply',
      body: '<strong>Already HTML</strong>',
      inReplyToMessageId: 'original-message',
      attachments: [{ filename: 'empty.bin', mimeType: '', data: '   ' }],
    });
    const mime = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .toString('utf8');

    expect(mime).toContain('Cc: copy@example.com');
    expect(mime).toContain('In-Reply-To: <original-message>');
    expect(mime).toContain('References: <original-message>');
    expect(mime).toContain('Content-Type: application/octet-stream');
  });
});

describe('Gmail metadata parsing', () => {
  it('maps headers, labels, categories, snippets, and nested attachments', () => {
    const result = parseMessageMetadata({
      id: 'message-1',
      threadId: 'thread-1',
      internalDate: '1710000000000',
      labelIds: ['INBOX', 'UNREAD', 'STARRED', 'CATEGORY_PROMOTIONS'],
      snippet: 'Save &amp; enjoy&nbsp;today',
      payload: {
        headers: [
          { name: 'From', value: '"Sender Name" <sender@example.com>' },
          { name: 'To', value: 'First <first@example.com>, second@example.com' },
          { name: 'Subject', value: 'Offer' },
          { name: 'Message-ID', value: '<rfc-123@example.com>' },
        ],
        parts: [{
          parts: [{
            filename: 'offer.pdf',
            body: { attachmentId: 'attachment-1' },
          }],
        }],
      },
    });

    expect(result).toMatchObject({
      gmailMessageId: 'message-1',
      gmailThreadId: 'thread-1',
      rfcMessageId: 'rfc-123@example.com',
      from: { name: 'Sender Name', email: 'sender@example.com' },
      subject: 'Offer',
      snippet: 'Save & enjoy today',
      isUnread: true,
      isStarred: true,
      isInbox: true,
      hasAttachment: true,
      gmailCategory: 'promotions',
    });
    expect(result?.to).toHaveLength(2);
  });

  it('uses safe defaults for incomplete metadata', () => {
    expect(parseMessageMetadata({ id: 'message-2', payload: {} })).toMatchObject({
      gmailMessageId: 'message-2',
      subject: '(No Subject)',
      to: [],
      isUnread: false,
      hasAttachment: false,
    });
  });

  it.each([
    ['CATEGORY_PRIMARY', 'primary'],
    ['CATEGORY_SOCIAL', 'social'],
    ['CATEGORY_UPDATES', 'updates'],
    ['CATEGORY_FORUMS', 'forums'],
  ])('maps %s to %s', (label, category) => {
    expect(parseMessageMetadata({ labelIds: [label] })?.gmailCategory).toBe(category);
  });

  it('returns null when malformed metadata throws during parsing', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const malformed = Object.defineProperty({}, 'payload', {
      get: () => { throw new Error('malformed payload'); },
    });

    expect(parseMessageMetadata(malformed)).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('Gmail API contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  it('fetches and sorts every message in a Gmail conversation', async () => {
    const message = (id: string, timestamp: number) => ({
      id,
      threadId: 'thread-1',
      internalDate: String(timestamp),
      labelIds: ['INBOX'],
      snippet: `Snippet ${id}`,
      payload: { headers: [
        { name: 'From', value: `Sender ${id} <${id}@example.com>` },
        { name: 'To', value: 'me@example.com' },
        { name: 'Subject', value: 'Conversation' },
      ] },
    });
    mockGmailApi.users.threads.get.mockResolvedValue({ data: { messages: [message('newer', 2000), message('older', 1000)] } });

    const result = await fetchFullThread({} as never, 'thread-1');

    expect(mockGmailApi.users.threads.get).toHaveBeenCalledWith({ userId: 'me', id: 'thread-1', format: 'full' });
    expect(result.map(({ id }) => id)).toEqual(['older', 'newer']);
  });

  it('lists message ids with pagination', async () => {
    mockGmailApi.users.messages.list.mockResolvedValue({
      data: {
        messages: [{ id: 'one' }, {}, { id: 'two' }],
        nextPageToken: 'next-page',
      },
    });

    await expect(
      listMessageIdsPage({} as never, 'in:inbox', 25, 'current-page'),
    ).resolves.toEqual({
      ids: ['one', 'two'],
      nextPageToken: 'next-page',
    });
    expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 25,
      pageToken: 'current-page',
    });
  });

  it('lists one page through the compatibility helper and defaults empty pages', async () => {
    mockGmailApi.users.messages.list
      .mockResolvedValueOnce({ data: { messages: [{ id: 'one' }] } })
      .mockResolvedValueOnce({ data: {} });

    await expect(listMessageIds({} as never, 'in:sent', 10)).resolves.toEqual(['one']);
    await expect(listMessageIdsPage({} as never, 'in:trash', 10)).resolves.toEqual({
      ids: [],
      nextPageToken: undefined,
    });
  });

  it('fetches full messages and handles unparsable provider payloads', async () => {
    const valid = {
      id: 'message-1',
      threadId: 'thread-1',
      payload: { headers: [] },
    };
    const malformed = { payload: { headers: [{ name: null }] } };
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockGmailApi.users.messages.get
      .mockResolvedValueOnce({ data: valid })
      .mockResolvedValueOnce({ data: malformed });

    await expect(fetchFullMessage({} as never, 'message-1')).resolves.toMatchObject({
      email: { id: 'message-1' },
      labelIds: [],
    });
    await expect(fetchFullMessage({} as never, 'bad')).resolves.toBeNull();
    consoleError.mockRestore();
  });

  it('defaults missing threads and filters malformed conversation messages', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockGmailApi.users.threads.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({
        data: { messages: [{ payload: { headers: [{ name: null }] } }] },
      });

    await expect(fetchFullThread({} as never, 'empty')).resolves.toEqual([]);
    await expect(fetchFullThread({} as never, 'malformed')).resolves.toEqual([]);
    consoleError.mockRestore();
  });

  it('keeps successful metadata results when one Gmail request fails', async () => {
    mockGmailApi.users.messages.get
      .mockResolvedValueOnce({
        data: {
          id: 'one',
          threadId: 'thread',
          payload: { headers: [] },
        },
      })
      .mockRejectedValueOnce(new Error('rate limited'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    await expect(
      fetchMessageMetadataBatch({} as never, ['one', 'two']),
    ).resolves.toHaveLength(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('collects paginated history changes and removes deleted ids', async () => {
    mockGmailApi.users.history.list
      .mockResolvedValueOnce({
        data: {
          historyId: '101',
          nextPageToken: 'page-2',
          history: [{
            messagesAdded: [{ message: { id: 'added' } }],
            labelsAdded: [{ message: { id: 'relabeled' } }],
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          historyId: '102',
          history: [{
            messagesDeleted: [{ message: { id: 'added' } }],
            labelsRemoved: [{ message: { id: 'changed' } }],
          }],
        },
      });

    await expect(listHistoryDelta({} as never, '100')).resolves.toEqual({
      newHistoryId: '102',
      changedMessageIds: ['relabeled', 'changed'],
      deletedMessageIds: ['added'],
      historyExpired: false,
    });
  });

  it('signals expired Gmail history', async () => {
    mockGmailApi.users.history.list.mockRejectedValue({ code: 410 });

    await expect(listHistoryDelta({} as never, 'old')).resolves.toEqual({
      newHistoryId: undefined,
      changedMessageIds: [],
      deletedMessageIds: [],
      historyExpired: true,
    });
  });

  it('handles every expired-history shape and rethrows unrelated failures', async () => {
    mockGmailApi.users.history.list
      .mockRejectedValueOnce({ code: 404 })
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockRejectedValueOnce(new Error('offline'));

    await expect(listHistoryDelta({} as never, 'old-404')).resolves.toMatchObject({ historyExpired: true });
    await expect(listHistoryDelta({} as never, 'old-response')).resolves.toMatchObject({ historyExpired: true });
    await expect(listHistoryDelta({} as never, 'current')).rejects.toThrow('offline');
  });

  it('defaults empty history records and ignores entries without ids', async () => {
    mockGmailApi.users.history.list.mockResolvedValue({
      data: {
        history: [{
          messagesAdded: [{ message: {} }],
          messagesDeleted: [{ message: {} }],
          labelsAdded: [{ message: {} }],
          labelsRemoved: [{ message: {} }],
        }, {}],
      },
    });

    await expect(listHistoryDelta({} as never, '100')).resolves.toEqual({
      newHistoryId: undefined,
      changedMessageIds: [],
      deletedMessageIds: [],
      historyExpired: false,
    });

    mockGmailApi.users.history.list.mockResolvedValue({ data: {} });
    await expect(listHistoryDelta({} as never, '101')).resolves.toMatchObject({
      changedMessageIds: [],
      deletedMessageIds: [],
      historyExpired: false,
    });
  });

  it('maps message, attachment, profile, send, and draft operations', async () => {
    mockGmailApi.users.messages.modify.mockResolvedValue({ data: { labelIds: ['INBOX'] } });
    mockGmailApi.users.messages.trash.mockResolvedValue({ data: { labelIds: ['TRASH'] } });
    mockGmailApi.users.messages.untrash.mockResolvedValue({ data: { labelIds: ['INBOX'] } });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({ data: { data: 'bytes' } });
    mockGmailApi.users.getProfile.mockResolvedValue({ data: { historyId: '200' } });
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: { id: 'sent', threadId: 'thread' },
    });
    mockGmailApi.users.drafts.create.mockResolvedValue({
      data: { id: 'draft', message: { id: 'message' } },
    });
    mockGmailApi.users.drafts.update.mockResolvedValue({
      data: { id: 'draft', message: { id: 'message-2' } },
    });
    mockGmailApi.users.drafts.delete.mockResolvedValue({ data: {} });
    mockGmailApi.users.drafts.list.mockResolvedValue({
      data: {
        drafts: [
          { id: 'draft', message: { id: 'message' } },
          { id: null, message: { id: 'ignored' } },
        ],
      },
    });
    mockGmailApi.users.drafts.send.mockResolvedValue({
      data: { id: 'sent-draft', threadId: 'thread' },
    });
    const outgoing = {
      to: ['recipient@example.com'],
      subject: 'Hello',
      body: 'Body',
    };

    await expect(modifyMessage({} as never, 'id', ['A'], ['B'])).resolves.toEqual(['INBOX']);
    await expect(trashMessage({} as never, 'id')).resolves.toEqual(['TRASH']);
    await expect(untrashMessage({} as never, 'id')).resolves.toEqual(['INBOX']);
    await expect(getAttachment({} as never, 'id', 'attachment')).resolves.toBe('bytes');
    await expect(getProfileHistoryId({} as never)).resolves.toBe('200');
    await expect(sendMessage({} as never, outgoing)).resolves.toEqual({
      id: 'sent',
      threadId: 'thread',
    });
    await expect(createDraft({} as never, outgoing)).resolves.toEqual({
      draftId: 'draft',
      messageId: 'message',
    });
    await expect(updateDraft({} as never, 'draft', outgoing)).resolves.toEqual({
      draftId: 'draft',
      messageId: 'message-2',
    });
    await expect(deleteDraft({} as never, 'draft')).resolves.toBeUndefined();
    await expect(listDrafts({} as never)).resolves.toEqual([
      { draftId: 'draft', messageId: 'message' },
    ]);
    await expect(sendDraft({} as never, 'draft')).resolves.toEqual({
      id: 'sent-draft',
      threadId: 'thread',
    });
  });

  it('uses empty provider fallbacks for labels, attachment data, profile, and drafts', async () => {
    mockGmailApi.users.messages.modify.mockResolvedValue({ data: {} });
    mockGmailApi.users.messages.trash.mockResolvedValue({ data: {} });
    mockGmailApi.users.messages.untrash.mockResolvedValue({ data: {} });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({ data: {} });
    mockGmailApi.users.getProfile.mockResolvedValue({ data: {} });
    mockGmailApi.users.drafts.list.mockResolvedValue({
      data: { drafts: [{ id: 'missing-message' }] },
    });

    await expect(modifyMessage({} as never, 'id', [], [])).resolves.toEqual([]);
    await expect(trashMessage({} as never, 'id')).resolves.toEqual([]);
    await expect(untrashMessage({} as never, 'id')).resolves.toEqual([]);
    await expect(getAttachment({} as never, 'id', 'attachment')).resolves.toBe('');
    await expect(getProfileHistoryId({} as never)).resolves.toBeUndefined();
    await expect(listDrafts({} as never, 10)).resolves.toEqual([]);

    mockGmailApi.users.drafts.list.mockResolvedValue({ data: {} });
    await expect(listDrafts({} as never, 10)).resolves.toEqual([]);
  });
});
