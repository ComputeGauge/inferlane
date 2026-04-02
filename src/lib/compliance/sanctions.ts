// ---------------------------------------------------------------------------
// Sanctions & Compliance Screening
// ---------------------------------------------------------------------------
// OFAC SDN list + EU sanctions + export controls + high-risk jurisdictions
// This is a simplified screening — production would use a sanctions API
// like ComplyAdvantage, Chainalysis, or Dow Jones Risk & Compliance.
// ---------------------------------------------------------------------------

import { logComplianceAudit, type ComplianceAuditEntry } from './audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanctionsCheckResult {
  allowed: boolean;
  reason?: string;
  restrictionType?: 'SANCTIONED_COUNTRY' | 'SANCTIONED_ENTITY' | 'EXPORT_CONTROLLED' | 'HIGH_RISK';
  country?: string;
}

// ---------------------------------------------------------------------------
// Sanctioned / restricted country lists
// ---------------------------------------------------------------------------

/** Fully sanctioned countries (OFAC comprehensive sanctions) */
const SANCTIONED_COUNTRIES = new Set([
  'CU',  // Cuba
  'IR',  // Iran
  'KP',  // North Korea (DPRK)
  'SY',  // Syria
  'RU',  // Russia (partial — compute/tech exports restricted)
  'BY',  // Belarus
]);

/** Countries with partial restrictions (export controls on AI/compute) */
const EXPORT_CONTROLLED = new Set([
  'CN',  // China — AI chip export controls (Oct 2022 BIS rules)
  'RU',  // Russia — tech export controls (also in SANCTIONED)
  'MM',  // Myanmar
  'VE',  // Venezuela
]);

/** High-risk jurisdictions (enhanced due diligence required, not blocked) */
const HIGH_RISK_JURISDICTIONS = new Set([
  'AF',  // Afghanistan
  'IQ',  // Iraq
  'LY',  // Libya
  'SO',  // Somalia
  'SD',  // Sudan
  'SS',  // South Sudan
  'YE',  // Yemen
  'ZW',  // Zimbabwe
  'LB',  // Lebanon (Hezbollah sanctions)
  'ML',  // Mali
  'CF',  // Central African Republic
  'CD',  // Democratic Republic of Congo
  'HT',  // Haiti
  'NI',  // Nicaragua
  'ER',  // Eritrea
]);

/** Disposable / throwaway email domains */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'dispostable.com',
  'maildrop.cc',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.me',
  'mailnesia.com',
  'getnada.com',
  'mohmal.com',
  'minutemail.com',
]);

/** Known sanctioned-entity email domains (illustrative — production uses SDN API) */
const SANCTIONED_ENTITY_DOMAINS = new Set([
  'irisl.net',        // Islamic Republic of Iran Shipping Lines
  'nioc.ir',          // National Iranian Oil Company
  'mofamail.gov.sy',  // Syrian government
]);

// ---------------------------------------------------------------------------
// IP geolocation cache (24h TTL)
// ---------------------------------------------------------------------------

interface CachedGeoResult {
  countryCode: string;
  expiresAt: number;
}

const IP_GEO_CACHE = new Map<string, CachedGeoResult>();
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Screening methods
// ---------------------------------------------------------------------------

class SanctionsScreener {
  /**
   * Check a 2-letter ISO country code against sanctions lists.
   */
  checkCountry(countryCode: string): SanctionsCheckResult {
    const cc = countryCode.toUpperCase();

    if (SANCTIONED_COUNTRIES.has(cc)) {
      return {
        allowed: false,
        reason: 'Country subject to comprehensive sanctions',
        restrictionType: 'SANCTIONED_COUNTRY',
        country: cc,
      };
    }

    if (EXPORT_CONTROLLED.has(cc)) {
      return {
        allowed: false,
        reason: 'AI compute export controls apply',
        restrictionType: 'EXPORT_CONTROLLED',
        country: cc,
      };
    }

    if (HIGH_RISK_JURISDICTIONS.has(cc)) {
      return {
        allowed: true,
        reason: 'Enhanced due diligence required',
        restrictionType: 'HIGH_RISK',
        country: cc,
      };
    }

    return { allowed: true, country: cc };
  }

  /**
   * Geolocate an IP address and check against sanctions.
   * Uses ipapi.co free tier — no key required.
   * Results are cached for 24 hours.
   */
  async checkIP(ipAddress: string): Promise<SanctionsCheckResult> {
    // Skip loopback / private addresses
    if (
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('172.')
    ) {
      return { allowed: true, country: 'PRIVATE' };
    }

    // Check cache
    const cached = IP_GEO_CACHE.get(ipAddress);
    if (cached && cached.expiresAt > Date.now()) {
      return this.checkCountry(cached.countryCode);
    }

    try {
      const res = await fetch(`https://ipapi.co/${ipAddress}/country/`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        // If geo lookup fails, allow through (fail open) — log for review
        console.warn(`[sanctions] IP geo lookup failed for ${ipAddress}: HTTP ${res.status}`);
        return { allowed: true };
      }

      const countryCode = (await res.text()).trim().toUpperCase();

      if (countryCode.length !== 2) {
        // Invalid response — fail open
        return { allowed: true };
      }

      // Cache
      IP_GEO_CACHE.set(ipAddress, {
        countryCode,
        expiresAt: Date.now() + GEO_CACHE_TTL_MS,
      });

      const result = this.checkCountry(countryCode);
      return { ...result, country: countryCode };
    } catch (err) {
      console.warn(`[sanctions] IP geo lookup error for ${ipAddress}:`, err);
      // Fail open — don't block legitimate users due to geo service downtime
      return { allowed: true };
    }
  }

  /**
   * Check an email address against sanctioned entity domains and disposable email providers.
   */
  checkEmail(email: string): SanctionsCheckResult {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return { allowed: false, reason: 'Invalid email address', restrictionType: 'SANCTIONED_ENTITY' };
    }

    if (SANCTIONED_ENTITY_DOMAINS.has(domain)) {
      return {
        allowed: false,
        reason: 'Email domain associated with sanctioned entity',
        restrictionType: 'SANCTIONED_ENTITY',
      };
    }

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        allowed: false,
        reason: 'Disposable email addresses are not permitted',
        restrictionType: 'SANCTIONED_ENTITY',
      };
    }

    return { allowed: true };
  }

  /**
   * Full user screening — runs all checks and returns the most restrictive result.
   * Logs to audit trail.
   */
  async screenUser(
    userId: string,
    ipAddress: string,
    email: string,
    action: ComplianceAuditEntry['action'],
    country?: string,
  ): Promise<SanctionsCheckResult> {
    const results: SanctionsCheckResult[] = [];

    // 1. Country check (if provided explicitly)
    if (country) {
      results.push(this.checkCountry(country));
    }

    // 2. IP geolocation check
    const ipResult = await this.checkIP(ipAddress);
    results.push(ipResult);

    // 3. Email check
    results.push(this.checkEmail(email));

    // Find most restrictive result (first blocked, then high-risk, then allowed)
    const blocked = results.find((r) => !r.allowed);
    const highRisk = results.find((r) => r.restrictionType === 'HIGH_RISK');
    const finalResult = blocked || highRisk || { allowed: true };

    // Determine country for audit
    const resolvedCountry = country || ipResult.country || 'UNKNOWN';

    // Log to audit trail
    const auditResult: ComplianceAuditEntry['result'] = !finalResult.allowed
      ? 'BLOCKED'
      : finalResult.restrictionType === 'HIGH_RISK'
        ? 'ENHANCED_DILIGENCE'
        : 'ALLOWED';

    logComplianceAudit({
      timestamp: new Date().toISOString(),
      userId,
      ipAddress,
      countryCode: resolvedCountry,
      action,
      result: auditResult,
      reason: finalResult.reason,
    });

    return finalResult;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const sanctionsScreener = new SanctionsScreener();
