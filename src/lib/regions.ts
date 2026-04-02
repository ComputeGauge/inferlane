// ---------------------------------------------------------------------------
// InferLane — Comprehensive Region System
// ---------------------------------------------------------------------------
// Canonical region definitions for node registration, routing, and UI display.
// ---------------------------------------------------------------------------

import { sanctionsScreener } from './compliance/sanctions';

// ---------------------------------------------------------------------------
// Region definition
// ---------------------------------------------------------------------------

export interface RegionInfo {
  name: string;
  continent: string;
  country: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// All platform regions
// ---------------------------------------------------------------------------

export const REGIONS: Record<string, RegionInfo> = {
  // North America
  'us-east-1':    { name: 'US East (Virginia)',           continent: 'NA', country: 'US', lat: 38.13,  lng: -78.45  },
  'us-west-2':    { name: 'US West (Oregon)',             continent: 'NA', country: 'US', lat: 45.59,  lng: -121.18 },
  'us-central-1': { name: 'US Central (Iowa)',            continent: 'NA', country: 'US', lat: 41.26,  lng: -95.86  },
  'ca-central-1': { name: 'Canada (Montreal)',            continent: 'NA', country: 'CA', lat: 45.50,  lng: -73.57  },

  // Europe
  'eu-west-1':    { name: 'Europe (Ireland)',             continent: 'EU', country: 'IE', lat: 53.33,  lng: -6.26   },
  'eu-west-2':    { name: 'Europe (London)',              continent: 'EU', country: 'GB', lat: 51.51,  lng: -0.12   },
  'eu-central-1': { name: 'Europe (Frankfurt)',           continent: 'EU', country: 'DE', lat: 50.11,  lng: 8.68    },
  'eu-north-1':   { name: 'Europe (Stockholm)',           continent: 'EU', country: 'SE', lat: 59.33,  lng: 18.07   },
  'eu-south-1':   { name: 'Europe (Milan)',               continent: 'EU', country: 'IT', lat: 45.46,  lng: 9.19    },

  // Asia Pacific
  'ap-southeast-1': { name: 'Asia Pacific (Singapore)',   continent: 'AP', country: 'SG', lat: 1.35,   lng: 103.82  },
  'ap-southeast-2': { name: 'Asia Pacific (Sydney)',      continent: 'AP', country: 'AU', lat: -33.87, lng: 151.21  },
  'ap-northeast-1': { name: 'Asia Pacific (Tokyo)',       continent: 'AP', country: 'JP', lat: 35.68,  lng: 139.69  },
  'ap-northeast-2': { name: 'Asia Pacific (Seoul)',       continent: 'AP', country: 'KR', lat: 37.57,  lng: 126.98  },
  'ap-south-1':     { name: 'Asia Pacific (Mumbai)',      continent: 'AP', country: 'IN', lat: 19.08,  lng: 72.88   },

  // South America
  'sa-east-1':  { name: 'South America (Sao Paulo)',      continent: 'SA', country: 'BR', lat: -23.55, lng: -46.63  },
  'sa-south-1': { name: 'South America (Buenos Aires)',   continent: 'SA', country: 'AR', lat: -34.60, lng: -58.38  },

  // Middle East
  'me-south-1':   { name: 'Middle East (Bahrain)',        continent: 'ME', country: 'BH', lat: 26.07,  lng: 50.56   },
  'me-central-1': { name: 'Middle East (UAE)',            continent: 'ME', country: 'AE', lat: 25.20,  lng: 55.27   },

  // Africa
  'af-south-1': { name: 'Africa (Cape Town)',             continent: 'AF', country: 'ZA', lat: -33.93, lng: 18.42   },
  'af-west-1':  { name: 'Africa (Lagos)',                 continent: 'AF', country: 'NG', lat: 6.52,   lng: 3.38    },
  'af-east-1':  { name: 'Africa (Nairobi)',               continent: 'AF', country: 'KE', lat: -1.29,  lng: 36.82   },
} as const;

export type RegionId = keyof typeof REGIONS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a single region by ID. Returns undefined if not found. */
export function getRegion(id: string): RegionInfo | undefined {
  return REGIONS[id];
}

/** Get all regions on a given continent (e.g. 'NA', 'EU', 'AP'). */
export function getRegionsByContinent(continent: string): Array<[string, RegionInfo]> {
  return Object.entries(REGIONS).filter(([, r]) => r.continent === continent);
}

/** Check if a string is a valid region ID. */
export function isValidRegion(id: string): boolean {
  return id in REGIONS;
}

/** Get all distinct continent codes. */
export function getAllContinents(): string[] {
  return [...new Set(Object.values(REGIONS).map((r) => r.continent))];
}

/** Check if a region is in a sanctioned country. */
export function isRegionSanctioned(regionId: string): boolean {
  const region = getRegion(regionId);
  if (!region) return false;
  const result = sanctionsScreener.checkCountry(region.country);
  return !result.allowed;
}

/** Validate an array of region IDs. Returns invalid ones. */
export function validateRegions(regionIds: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const id of regionIds) {
    if (isValidRegion(id)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  }
  return { valid, invalid };
}

/** Get continent display name. */
export function getContinentName(code: string): string {
  const names: Record<string, string> = {
    NA: 'North America',
    EU: 'Europe',
    AP: 'Asia Pacific',
    SA: 'South America',
    ME: 'Middle East',
    AF: 'Africa',
  };
  return names[code] || code;
}
