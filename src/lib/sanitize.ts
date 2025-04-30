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
  // We can configure allowed tags and attributes here if needed,
  // but the default configuration is usually a good starting point.
  // Example: purify.sanitize(dirty, { USE_PROFILES: { html: true } });
  return purify.sanitize(dirty);
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