import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a JSDOM window and configure DOMPurify
// It's important to create the window instance outside the function
// for better performance, avoiding recreation on every call.
const window = new JSDOM('').window;
const purify = DOMPurify(window as any); // Use 'as any' due to potential type mismatches

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Allows basic formatting tags but removes scripts and dangerous attributes.
 *
 * @param dirty The potentially unsafe HTML string.
 * @returns The sanitized HTML string.
 */
export function sanitizeHtml(dirty: string): string {
  // Return sanitized string
  // We configure DOMPurify to allow specific safe HTML tags for formatting
  // while still preventing XSS by default.
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 'strong', 'em', // Basic emphasis
      'p', 'br', // Paragraphs and line breaks
      'h2', 'h3', 'h4', // Headings (avoid h1 for semantics)
      'ul', 'ol', 'li', // Lists
      'a' // Links (attributes will be checked by default)
    ],
    ALLOWED_ATTR: ['href', 'target', 'title'] // Allow common link attributes
    // KEEP_CONTENT: true is the default
  });
}

/**
 * Sanitizes a plain text string by essentially stripping any potential HTML/XML tags.
 * This is useful for fields where no HTML is expected (like titles, locations).
 *
 * @param dirty The potentially unsafe string.
 * @returns The sanitized plain text string (tags stripped).
 */
export function sanitizePlainText(dirty: string): string {
    // Simple sanitization: return the plain text content after potential HTML parsing
    // This effectively strips tags. For more robust stripping, a dedicated library
    // or more complex regex might be used, but DOMPurify's approach covers many cases.
    const sanitized = purify.sanitize(dirty, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
    // Trim whitespace that might be left after tag removal
    return sanitized.trim();
} 