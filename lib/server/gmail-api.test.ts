import { buildRawMessage } from './gmail-api';

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
});
