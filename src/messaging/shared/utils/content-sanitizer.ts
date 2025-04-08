import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class ContentSanitizer {
  private readonly maxLength = 5000;
  private readonly sanitizeOptions: sanitizeHtml.IOptions;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ContentSanitizer.name);
    this.sanitizeOptions = this.configureSanitizer();
  }

  private configureSanitizer(): sanitizeHtml.IOptions {
    return {
      allowedTags: [
        'p',
        'br',
        'b',
        'i',
        'em',
        'strong',
        'a',
        'span',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        span: ['data-mention', 'class'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: {
        a: ['http', 'https', 'mailto'],
      },
      allowedSchemesAppliedToAttributes: ['href'],
      allowProtocolRelative: false,
      allowedClasses: {
        span: ['mention', 'emoji'],
        code: ['language-*'],
      },
      parser: {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true,
      },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      },
      exclusiveFilter: (frame) => {
        // Block any scripts or dangerous patterns
        const content = frame.text || '';
        const dangerous =
          /(javascript|data|vbscript):/i.test(content) ||
          /on\w+\s*=/i.test(content) ||
          /expression\s*\(/i.test(content);
        if (dangerous) {
          this.logger.warn('Blocked dangerous content', { content });
          return true;
        }
        return false;
      },
    };
  }

  sanitizeRealtimeMessage(content: any): { isValid: boolean; sanitized: any } {
    try {
      if (typeof content === 'string') {
        const sanitized = sanitizeHtml(content, this.sanitizeOptions);
        return {
          isValid: !!sanitized && sanitized.length <= this.maxLength,
          sanitized: sanitized.slice(0, this.maxLength),
        };
      }

      if (typeof content === 'object' && content !== null) {
        const sanitized = this.sanitizeMessageObject(content);
        return {
          isValid: true,
          sanitized,
        };
      }

      return { isValid: false, sanitized: null };
    } catch (error) {
      this.logger.error('Realtime message sanitization failed:', error);
      return { isValid: false, sanitized: null };
    }
  }

  private sanitizeMessageObject(obj: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeHtml(value, this.sanitizeOptions);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'string'
            ? sanitizeHtml(item, this.sanitizeOptions)
            : this.sanitizeMessageObject(item),
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMessageObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  sanitize(content: string): string {
    try {
      if (!content) return '';

      content = content.trim();
      if (content.length > this.maxLength) {
        this.logger.warn(
          `Content truncated from ${content.length} to ${this.maxLength} characters`,
        );
        content = content.slice(0, this.maxLength);
      }

      return sanitizeHtml(content, this.sanitizeOptions);
    } catch (error) {
      this.logger.error('Sanitization error:', error);
      // Fallback to strict sanitization
      return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
    }
  }

  sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const allowedMetadataKeys = ['caption', 'location', 'mentions'];
    return Object.entries(metadata).reduce((safe, [key, value]) => {
      if (allowedMetadataKeys.includes(key)) {
        if (typeof value === 'string') {
          safe[key] = this.sanitize(value);
        } else if (typeof value === 'object' && value !== null) {
          safe[key] = this.sanitizeMetadata(value);
        } else {
          safe[key] = value;
        }
      }
      return safe;
    }, {});
  }
}
