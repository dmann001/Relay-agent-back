// Utility functions for email content processing
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML content by removing dangerous tags and attributes
 * while preserving safe formatting and styles.
 */
export function sanitizeEmailHTML(html: string): string {
    if (!html) return '';

    // First, decode HTML entities that might be double-encoded or escaped
    let decoded = html;
    try {
        // Check if HTML is escaped (starts with &lt; or contains &amp;lt;)
        const isEscaped = /^(&lt;|&amp;lt;)/i.test(decoded.trim()) || 
                         /&amp;lt;[a-z]/i.test(decoded);
        
        if (isEscaped) {
            // Decode double-encoded entities
            decoded = decoded
                .replace(/&amp;lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&amp;amp;/g, '&')
                .replace(/&amp;quot;/g, '"')
                .replace(/&amp;#39;/g, "'")
                .replace(/&amp;nbsp;/g, ' ');
            
            // Then decode regular entities
            decoded = decoded
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');
        }
        
        // Try to decode other entities using the browser's decoder if available
        if (typeof document !== 'undefined') {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = decoded;
            decoded = textarea.value;
        }
    } catch (e) {
        // If decoding fails, continue with original
        console.warn('HTML entity decoding failed:', e);
    }

    // Configure DOMPurify - be more aggressive about removing styles that cause visual issues
    let clean = DOMPurify.sanitize(decoded, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['center', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col'],
        ADD_ATTR: [
            'target', 'class', 'id', 'align', 'valign', 'bgcolor', 
            'width', 'height', 'cellpadding', 'cellspacing',
            'colspan', 'rowspan', 'scope', 'headers', 'dir'
        ],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'style'],
        FORBID_ATTR: ['onmouseover', 'onclick', 'onload', 'onerror', 'onfocus', 'onblur', 'onchange', 'style', 'border'],
        WHOLE_DOCUMENT: false,
        KEEP_CONTENT: true,
    });

    // Aggressively remove empty and structural elements that cause boxes
    let previousClean = '';
    let iterations = 0;
    const maxIterations = 10;
    
    while (clean !== previousClean && iterations < maxIterations) {
        previousClean = clean;
        iterations++;
        
        // Remove empty elements
        clean = clean.replace(/<div[^>]*>\s*<\/div>/gi, '');
        clean = clean.replace(/<span[^>]*>\s*<\/span>/gi, '');
        clean = clean.replace(/<p[^>]*>\s*<\/p>/gi, '');
        clean = clean.replace(/<td[^>]*>\s*<\/td>/gi, '<td></td>');
        clean = clean.replace(/<th[^>]*>\s*<\/th>/gi, '<th></th>');
        
        // Remove empty table rows
        clean = clean.replace(/<tr[^>]*>(\s*<td><\/td>\s*)*<\/tr>/gi, '');
        clean = clean.replace(/<tr[^>]*>\s*<\/tr>/gi, '');
        
        // Remove empty tables
        clean = clean.replace(/<table[^>]*>\s*(<tbody[^>]*>\s*<\/tbody>)?\s*<\/table>/gi, '');
        clean = clean.replace(/<tbody[^>]*>\s*<\/tbody>/gi, '');
        
        // Remove center tags wrapping nothing useful
        clean = clean.replace(/<center[^>]*>\s*<\/center>/gi, '');
        
        // Remove br-only content
        clean = clean.replace(/<div[^>]*>\s*(<br\s*\/?>)\s*<\/div>/gi, '<br>');
    }
    
    // Remove excessive whitespace between tags
    clean = clean.replace(/>\s+</g, '> <');
    
    // Remove multiple consecutive br tags
    clean = clean.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

    return clean.trim();
}

/**
 * Extracts plain text from HTML, removing all tags
 */
export function htmlToPlainText(html: string): string {
    if (!html) return '';

    // Remove all HTML tags
    let text = html.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

/**
 * Determines if content is HTML or plain text
 */
export function isHTML(content: string): boolean {
    if (!content) return false;
    
    // Check for HTML tags (including escaped ones)
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(content);
    
    // Also check for escaped HTML entities that suggest HTML content
    const hasEscapedHtml = /&lt;[a-z][\s\S]*&gt;/i.test(content) || 
                           /&amp;lt;[a-z][\s\S]*&amp;gt;/i.test(content);
    
    // Check for common HTML patterns even if escaped
    const hasHtmlPatterns = /&lt;\/?(div|p|span|table|tr|td|th|a|img|br|h[1-6]|ul|ol|li|strong|em|b|i)/i.test(content);
    
    return hasHtmlTags || hasEscapedHtml || hasHtmlPatterns;
}

/**
 * Cleans and formats email content for display
 */
export function formatEmailContent(body: string, bodyPlain?: string): { html: string; isHtml: boolean } {
    // If body is empty or undefined, check bodyPlain for HTML
    if (!body || !body.trim()) {
        if (bodyPlain && bodyPlain.trim()) {
            // Check if bodyPlain is actually HTML (sometimes HTML gets stored in bodyPlain)
            if (isHTML(bodyPlain)) {
                return {
                    html: sanitizeEmailHTML(bodyPlain),
                    isHtml: true
                };
            }
            return {
                html: bodyPlain,
                isHtml: false
            };
        }
        return {
            html: '',
            isHtml: false
        };
    }

    // Check if body is HTML (this should catch most cases)
    if (isHTML(body)) {
        return {
            html: sanitizeEmailHTML(body),
            isHtml: true
        };
    }

    // Additional check: if body is much longer than bodyPlain and contains URL patterns,
    // it might be HTML that wasn't detected (common in marketing emails)
    if (bodyPlain && body.length > bodyPlain.length * 1.5 && /https?:\/\/[^\s]+/i.test(body)) {
        // Try to detect if it's actually HTML by looking for common patterns
        if (/<[a-z]|&lt;[a-z]|&amp;lt;[a-z]/i.test(body)) {
            return {
                html: sanitizeEmailHTML(body),
                isHtml: true
            };
        }
    }

    // Last resort: check if bodyPlain is HTML (sometimes the HTML part ends up in bodyPlain)
    if (bodyPlain && isHTML(bodyPlain) && !isHTML(body)) {
        return {
            html: sanitizeEmailHTML(bodyPlain),
            isHtml: true
        };
    }

    // Use plain text if available and body is not HTML
    if (bodyPlain && bodyPlain.trim()) {
        return {
            html: bodyPlain,
            isHtml: false
        };
    }

    // Fallback to body as plain text
    return {
        html: body,
        isHtml: false
    };
}

/**
 * Formats attachment size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
