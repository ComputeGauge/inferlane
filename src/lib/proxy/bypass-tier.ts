// Tier 0 Bypass Layer — answers requests WITHOUT calling any LLM
// Saves 100% cost, responds in <1ms for deterministic queries.

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BypassResult {
  bypass: boolean;
  response?: string;
  reason?: string;
}

interface ChatMessage {
  role: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Safe math parser — NO eval()
// Supports: +, -, *, /, parentheses, decimals, negation
// ---------------------------------------------------------------------------

function parseMathExpression(expr: string): number | null {
  // Strip whitespace, commas (thousands separators)
  const cleaned = expr.replace(/\s+/g, '').replace(/,/g, '');

  // Validate: only digits, operators, parens, dots allowed
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null;
  if (cleaned.length === 0) return null;

  let pos = 0;

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < cleaned.length) {
      if (cleaned[pos] === '+') {
        pos++;
        result += parseTerm();
      } else if (cleaned[pos] === '-') {
        pos++;
        result -= parseTerm();
      } else {
        break;
      }
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < cleaned.length) {
      if (cleaned[pos] === '*') {
        pos++;
        result *= parseFactor();
      } else if (cleaned[pos] === '/') {
        pos++;
        const divisor = parseFactor();
        if (divisor === 0) throw new Error('Division by zero');
        result /= divisor;
      } else {
        break;
      }
    }
    return result;
  }

  function parseFactor(): number {
    // Unary minus
    if (cleaned[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    // Parenthesized sub-expression
    if (cleaned[pos] === '(') {
      pos++; // skip '('
      const result = parseExpr();
      if (cleaned[pos] === ')') pos++; // skip ')'
      return result;
    }
    // Number (integer or decimal)
    const start = pos;
    while (pos < cleaned.length && (/\d/.test(cleaned[pos]) || cleaned[pos] === '.')) {
      pos++;
    }
    const numStr = cleaned.substring(start, pos);
    if (numStr.length === 0) throw new Error('Unexpected token');
    return parseFloat(numStr);
  }

  try {
    const result = parseExpr();
    if (pos < cleaned.length) return null; // Unparsed remainder
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pattern matchers for each bypass category
// ---------------------------------------------------------------------------

// Math: "what is 2+2", "calculate 15*3", "100/5", "2+2=?"
const MATH_PATTERNS = [
  /^(?:what(?:'s| is)\s+)?(?:calculate\s+)?(\d[\d+\-*/().,%\s]+\d)\s*[=?]*\s*$/i,
  /^(?:calculate|compute|eval(?:uate)?|solve)\s+(.+)$/i,
  /^(\d[\d+\-*/().,\s]+\d)\s*$/,
];

// Date/time
const DATETIME_PATTERNS = [
  /\b(?:what(?:'s| is)\s+)?(?:the\s+)?(?:current\s+)?(?:date|time|day)\b/i,
  /\b(?:what(?:'s| is)\s+)?today(?:'s)?\s*(?:date)?\b/i,
  /\b(?:current|today)\s*(?:date|time|day|datetime)\b/i,
];

// Echo/repeat
const ECHO_PATTERNS = [
  /^(?:repeat\s+(?:after\s+me|this|back)?[:.]?\s*)(.+)$/i,
  /^(?:say|echo)\s+(.+)$/i,
];

// UUID
const UUID_PATTERNS = [
  /\b(?:generate|create|give\s+me|make)\s+(?:a\s+)?(?:new\s+)?uuid\b/i,
  /\b(?:random\s+)?uuid\b/i,
];

// JSON validation
const JSON_VALIDATE_PATTERNS = [
  /^(?:is\s+(?:this\s+)?(?:valid\s+)?json[:.]?\s*)(.+)$/i,
  /^(?:validate\s+json[:.]?\s*)(.+)$/i,
  /^(?:check\s+(?:if\s+)?(?:this\s+is\s+)?(?:valid\s+)?json[:.]?\s*)(.+)$/i,
];

// Base64
const BASE64_ENCODE_PATTERNS = [
  /^(?:base64\s+encode|encode\s+(?:to\s+)?base64)[:.]?\s*(.+)$/i,
  /^(?:btoa)[:.]?\s*(.+)$/i,
];
const BASE64_DECODE_PATTERNS = [
  /^(?:base64\s+decode|decode\s+(?:from\s+)?base64)[:.]?\s*(.+)$/i,
  /^(?:atob)[:.]?\s*(.+)$/i,
];

// Word/char count
const WORD_COUNT_PATTERNS = [
  /^(?:count\s+(?:the\s+)?words?\s+(?:in|of)[:.]?\s*)(.+)$/i,
  /^(?:how\s+many\s+words?\s+(?:in|are\s+in|does\s+.+\s+have)[:.]?\s*)(.+)$/i,
  /^(?:word\s+count\s+(?:of|for)[:.]?\s*)(.+)$/i,
];
const CHAR_COUNT_PATTERNS = [
  /^(?:count\s+(?:the\s+)?(?:characters?|chars?|letters?)\s+(?:in|of)[:.]?\s*)(.+)$/i,
  /^(?:how\s+many\s+(?:characters?|chars?|letters?)\s+(?:in|are\s+in)[:.]?\s*)(.+)$/i,
  /^(?:(?:character|char)\s+count\s+(?:of|for)[:.]?\s*)(.+)$/i,
  /^(?:(?:length|len)\s+(?:of)[:.]?\s*)(.+)$/i,
];

// Case conversion
const UPPERCASE_PATTERNS = [
  /^(?:(?:convert\s+(?:to\s+)?)?uppercase|to\s+upper(?:case)?|upper(?:case)?)[:.]?\s+(.+)$/i,
  /^(?:make\s+(?:this\s+)?uppercase[:.]?\s*)(.+)$/i,
];
const LOWERCASE_PATTERNS = [
  /^(?:(?:convert\s+(?:to\s+)?)?lowercase|to\s+lower(?:case)?|lower(?:case)?)[:.]?\s+(.+)$/i,
  /^(?:make\s+(?:this\s+)?lowercase[:.]?\s*)(.+)$/i,
];

// Hash generation
const HASH_PATTERNS = [
  /^(?:(?:md5|sha256|sha512|sha1|sha-256|sha-512|sha-1)\s+(?:of|hash|for)[:.]?\s*)(.+)$/i,
  /^(?:hash\s+(?:of\s+)?(?:using\s+)?(md5|sha256|sha512|sha1|sha-256|sha-512|sha-1)[:.]?\s*)(.+)$/i,
  /^(?:(?:compute|calculate|generate)\s+(?:the\s+)?(md5|sha256|sha512|sha1|sha-256|sha-512|sha-1)\s+(?:hash\s+)?(?:of|for)[:.]?\s*)(.+)$/i,
];

// Regex testing
const REGEX_TEST_PATTERNS = [
  /^(?:does\s+)["']?(.+?)["']?\s+match\s+(?:(?:the\s+)?(?:pattern|regex|regexp)\s+)?["'/](.+?)["'/]\s*[?]?\s*$/i,
  /^(?:test\s+(?:the\s+)?(?:regex|regexp|pattern)\s+)["'/](.+?)["'/]\s+(?:against|on|with)\s+["']?(.+?)["']?\s*$/i,
];

// ---------------------------------------------------------------------------
// BypassTier class
// ---------------------------------------------------------------------------

export class BypassTier {

  /**
   * Check if a request can be answered without calling any LLM.
   * Only inspects the last user message in the messages array.
   */
  canBypass(messages: ChatMessage[] | undefined | null): BypassResult {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { bypass: false };
    }

    // Get last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || typeof lastUserMsg.content !== 'string') {
      return { bypass: false };
    }

    const content = lastUserMsg.content.trim();
    if (content.length === 0 || content.length > 500) {
      return { bypass: false }; // Too long = not a simple bypass candidate
    }

    // Try each handler in order
    return (
      this.tryMath(content) ||
      this.tryDateTime(content) ||
      this.tryEcho(content) ||
      this.tryUuid(content) ||
      this.tryJsonValidate(content) ||
      this.tryBase64Encode(content) ||
      this.tryBase64Decode(content) ||
      this.tryWordCount(content) ||
      this.tryCharCount(content) ||
      this.tryUppercase(content) ||
      this.tryLowercase(content) ||
      this.tryHash(content) ||
      this.tryRegex(content) ||
      { bypass: false }
    );
  }

  // ── Math ──
  private tryMath(content: string): BypassResult | null {
    for (const pat of MATH_PATTERNS) {
      const m = content.match(pat);
      if (m) {
        const expr = m[1] || content;
        const result = parseMathExpression(expr);
        if (result !== null) {
          // Format nicely: avoid floating point artifacts
          const formatted = Number.isInteger(result)
            ? result.toString()
            : parseFloat(result.toPrecision(12)).toString();
          return { bypass: true, response: formatted, reason: 'math' };
        }
      }
    }
    return null;
  }

  // ── Date/time ──
  private tryDateTime(content: string): BypassResult | null {
    for (const pat of DATETIME_PATTERNS) {
      if (pat.test(content)) {
        const now = new Date();
        const response = now.toISOString();
        return { bypass: true, response, reason: 'datetime' };
      }
    }
    return null;
  }

  // ── Echo/repeat ──
  private tryEcho(content: string): BypassResult | null {
    for (const pat of ECHO_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        return { bypass: true, response: m[1].trim(), reason: 'echo' };
      }
    }
    return null;
  }

  // ── UUID ──
  private tryUuid(content: string): BypassResult | null {
    for (const pat of UUID_PATTERNS) {
      if (pat.test(content)) {
        const uuid = crypto.randomUUID();
        return { bypass: true, response: uuid, reason: 'uuid' };
      }
    }
    return null;
  }

  // ── JSON validation ──
  private tryJsonValidate(content: string): BypassResult | null {
    for (const pat of JSON_VALIDATE_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        try {
          JSON.parse(m[1].trim());
          return { bypass: true, response: 'Valid JSON.', reason: 'json_validate' };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          return { bypass: true, response: `Invalid JSON: ${errMsg}`, reason: 'json_validate' };
        }
      }
    }
    return null;
  }

  // ── Base64 encode ──
  private tryBase64Encode(content: string): BypassResult | null {
    for (const pat of BASE64_ENCODE_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        const encoded = Buffer.from(m[1].trim()).toString('base64');
        return { bypass: true, response: encoded, reason: 'base64_encode' };
      }
    }
    return null;
  }

  // ── Base64 decode ──
  private tryBase64Decode(content: string): BypassResult | null {
    for (const pat of BASE64_DECODE_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        try {
          const decoded = Buffer.from(m[1].trim(), 'base64').toString('utf-8');
          return { bypass: true, response: decoded, reason: 'base64_decode' };
        } catch {
          return { bypass: true, response: 'Error: invalid base64 input.', reason: 'base64_decode' };
        }
      }
    }
    return null;
  }

  // ── Word count ──
  private tryWordCount(content: string): BypassResult | null {
    for (const pat of WORD_COUNT_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        const text = m[1].trim().replace(/^["']|["']$/g, '');
        const count = text.split(/\s+/).filter(w => w.length > 0).length;
        return { bypass: true, response: `${count} word${count !== 1 ? 's' : ''}`, reason: 'word_count' };
      }
    }
    return null;
  }

  // ── Character count ──
  private tryCharCount(content: string): BypassResult | null {
    for (const pat of CHAR_COUNT_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        const text = m[1].trim().replace(/^["']|["']$/g, '');
        const count = text.length;
        return { bypass: true, response: `${count} character${count !== 1 ? 's' : ''}`, reason: 'char_count' };
      }
    }
    return null;
  }

  // ── Uppercase ──
  private tryUppercase(content: string): BypassResult | null {
    for (const pat of UPPERCASE_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        return { bypass: true, response: m[1].trim().toUpperCase(), reason: 'uppercase' };
      }
    }
    return null;
  }

  // ── Lowercase ──
  private tryLowercase(content: string): BypassResult | null {
    for (const pat of LOWERCASE_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1]) {
        return { bypass: true, response: m[1].trim().toLowerCase(), reason: 'lowercase' };
      }
    }
    return null;
  }

  // ── Hash generation ──
  private tryHash(content: string): BypassResult | null {
    for (const pat of HASH_PATTERNS) {
      const m = content.match(pat);
      if (!m) continue;

      let algo: string;
      let input: string;

      if (m.length === 3) {
        // Pattern captured algo and input separately
        algo = m[1].toLowerCase().replace(/-/g, '');
        input = m[2].trim();
      } else {
        // Algo is in the pattern itself — extract from the original content
        const algoMatch = content.match(/\b(md5|sha256|sha512|sha1|sha-256|sha-512|sha-1)\b/i);
        if (!algoMatch) continue;
        algo = algoMatch[1].toLowerCase().replace(/-/g, '');
        input = m[1].trim();
      }

      // Map to Node.js crypto algorithm names
      const algoMap: Record<string, string> = {
        md5: 'md5',
        sha1: 'sha1',
        sha256: 'sha256',
        sha512: 'sha512',
      };

      const nodeAlgo = algoMap[algo];
      if (!nodeAlgo) continue;

      try {
        const hash = createHash(nodeAlgo).update(input).digest('hex');
        return { bypass: true, response: hash, reason: `hash_${algo}` };
      } catch {
        continue;
      }
    }
    return null;
  }

  // ── Regex testing ──
  private tryRegex(content: string): BypassResult | null {
    for (const pat of REGEX_TEST_PATTERNS) {
      const m = content.match(pat);
      if (m && m[1] && m[2]) {
        // First pattern: m[1]=input, m[2]=pattern
        // Second pattern: m[1]=pattern, m[2]=input
        const isFirstFormat = pat === REGEX_TEST_PATTERNS[0];
        const input = isFirstFormat ? m[1].trim() : m[2].trim();
        const pattern = isFirstFormat ? m[2].trim() : m[1].trim();

        try {
          const regex = new RegExp(pattern);
          const matches = regex.test(input);
          return {
            bypass: true,
            response: matches
              ? `Yes, "${input}" matches the pattern /${pattern}/.`
              : `No, "${input}" does not match the pattern /${pattern}/.`,
            reason: 'regex_test',
          };
        } catch {
          return {
            bypass: true,
            response: `Invalid regex pattern: /${pattern}/`,
            reason: 'regex_test',
          };
        }
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const bypassTier = new BypassTier();
