import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Disease Outbreaks
 *
 * Pulls the latest WHO Disease Outbreak News (DON) feed and projects each
 * report onto a country (or regional) marker. Cached server-side for 4h —
 * WHO publishes new DONs on a weekly-ish cadence so freshness is generous.
 *
 * The WHO API returns titles like "Disease - Country" or "Disease – Multi-
 * country"; we parse, country-match against a curated centroid table,
 * categorise by disease family, then merge multiple DONs per country into
 * one richer marker for the popup.
 */

// WHO uses OData parameters with literal $-prefixed keys. URL constructor
// handles the encoding correctly; manual %24 escaping was getting re-encoded
// to %2524 by Node's fetch and returning 400.
function whoUrl(): string {
  const u = new URL('https://www.who.int/api/news/diseaseoutbreaknews');
  u.searchParams.set('sf_culture', 'en');
  u.searchParams.set('$orderby', 'PublicationDateAndTime desc');
  u.searchParams.set('$top', '100');  // WHO API caps $top at 100
  return u.toString();
}
const TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_KEY = 'who-outbreaks';

type DiseaseFamily = 'vhf' | 'respiratory' | 'vector' | 'bacterial' | 'vpd' | 'mpox' | 'other';

interface CountryCoord { iso: string; name: string; lat: number; lng: number; region: string; }
// Curated lookup table — keys are WHO's spelling variations as they appear in titles.
const COUNTRIES: Record<string, CountryCoord> = {
  // Africa
  'Angola':                    { iso: 'AO', name: 'Angola',                    lat: -11.20, lng:  17.87, region: 'Africa' },
  'Burundi':                   { iso: 'BI', name: 'Burundi',                   lat:  -3.37, lng:  29.92, region: 'Africa' },
  'Cameroon':                  { iso: 'CM', name: 'Cameroon',                  lat:   7.37, lng:  12.35, region: 'Africa' },
  'Central African Republic':  { iso: 'CF', name: 'Central African Republic',  lat:   6.61, lng:  20.94, region: 'Africa' },
  'Chad':                      { iso: 'TD', name: 'Chad',                      lat:  15.45, lng:  18.73, region: 'Africa' },
  'Comoros':                   { iso: 'KM', name: 'Comoros',                   lat: -11.65, lng:  43.33, region: 'Africa' },
  'Democratic Republic of the Congo': { iso: 'CD', name: 'DR Congo',          lat:  -4.04, lng:  21.76, region: 'Africa' },
  "Cote d'Ivoire":             { iso: 'CI', name: "Côte d'Ivoire",             lat:   7.54, lng:  -5.55, region: 'Africa' },
  'Egypt':                     { iso: 'EG', name: 'Egypt',                     lat:  26.82, lng:  30.80, region: 'Africa' },
  'Equatorial Guinea':         { iso: 'GQ', name: 'Equatorial Guinea',         lat:   1.65, lng:  10.27, region: 'Africa' },
  'Eritrea':                   { iso: 'ER', name: 'Eritrea',                   lat:  15.18, lng:  39.78, region: 'Africa' },
  'Ethiopia':                  { iso: 'ET', name: 'Ethiopia',                  lat:   9.15, lng:  40.49, region: 'Africa' },
  'Ghana':                     { iso: 'GH', name: 'Ghana',                     lat:   7.95, lng:  -1.02, region: 'Africa' },
  'Guinea':                    { iso: 'GN', name: 'Guinea',                    lat:   9.95, lng: -10.94, region: 'Africa' },
  'Kenya':                     { iso: 'KE', name: 'Kenya',                     lat:  -0.02, lng:  37.91, region: 'Africa' },
  'Liberia':                   { iso: 'LR', name: 'Liberia',                   lat:   6.43, lng:  -9.43, region: 'Africa' },
  'Libya':                     { iso: 'LY', name: 'Libya',                     lat:  26.34, lng:  17.23, region: 'Africa' },
  'Madagascar':                { iso: 'MG', name: 'Madagascar',                lat: -18.77, lng:  46.87, region: 'Africa' },
  'Malawi':                    { iso: 'MW', name: 'Malawi',                    lat: -13.25, lng:  34.30, region: 'Africa' },
  'Mali':                      { iso: 'ML', name: 'Mali',                      lat:  17.57, lng:  -3.99, region: 'Africa' },
  'Mauritania':                { iso: 'MR', name: 'Mauritania',                lat:  21.01, lng: -10.94, region: 'Africa' },
  'Morocco':                   { iso: 'MA', name: 'Morocco',                   lat:  31.79, lng:  -7.09, region: 'Africa' },
  'Mozambique':                { iso: 'MZ', name: 'Mozambique',                lat: -18.67, lng:  35.53, region: 'Africa' },
  'Niger':                     { iso: 'NE', name: 'Niger',                     lat:  17.61, lng:   8.08, region: 'Africa' },
  'Nigeria':                   { iso: 'NG', name: 'Nigeria',                   lat:   9.08, lng:   8.68, region: 'Africa' },
  'Rwanda':                    { iso: 'RW', name: 'Rwanda',                    lat:  -1.94, lng:  29.87, region: 'Africa' },
  'Senegal':                   { iso: 'SN', name: 'Senegal',                   lat:  14.50, lng: -14.45, region: 'Africa' },
  'Sierra Leone':              { iso: 'SL', name: 'Sierra Leone',              lat:   8.46, lng: -11.78, region: 'Africa' },
  'Somalia':                   { iso: 'SO', name: 'Somalia',                   lat:   5.15, lng:  46.20, region: 'Africa' },
  'South Africa':              { iso: 'ZA', name: 'South Africa',              lat: -30.56, lng:  22.94, region: 'Africa' },
  'South Sudan':               { iso: 'SS', name: 'South Sudan',               lat:   6.88, lng:  31.31, region: 'Africa' },
  'Sudan':                     { iso: 'SD', name: 'Sudan',                     lat:  12.86, lng:  30.22, region: 'Africa' },
  'Tanzania':                  { iso: 'TZ', name: 'Tanzania',                  lat:  -6.37, lng:  34.89, region: 'Africa' },
  'United Republic of Tanzania': { iso: 'TZ', name: 'Tanzania',                lat:  -6.37, lng:  34.89, region: 'Africa' },
  'Tunisia':                   { iso: 'TN', name: 'Tunisia',                   lat:  33.89, lng:   9.54, region: 'Africa' },
  'Uganda':                    { iso: 'UG', name: 'Uganda',                    lat:   1.37, lng:  32.29, region: 'Africa' },
  'Zambia':                    { iso: 'ZM', name: 'Zambia',                    lat: -13.13, lng:  27.85, region: 'Africa' },
  'Zimbabwe':                  { iso: 'ZW', name: 'Zimbabwe',                  lat: -19.02, lng:  29.15, region: 'Africa' },

  // Asia + Oceania
  'Afghanistan':               { iso: 'AF', name: 'Afghanistan',               lat:  33.94, lng:  67.71, region: 'Asia-Pacific' },
  'Australia':                 { iso: 'AU', name: 'Australia',                 lat: -25.27, lng: 133.78, region: 'Asia-Pacific' },
  'Bangladesh':                { iso: 'BD', name: 'Bangladesh',                lat:  23.69, lng:  90.36, region: 'Asia-Pacific' },
  'Bhutan':                    { iso: 'BT', name: 'Bhutan',                    lat:  27.51, lng:  90.43, region: 'Asia-Pacific' },
  'Cambodia':                  { iso: 'KH', name: 'Cambodia',                  lat:  12.57, lng: 104.99, region: 'Asia-Pacific' },
  'China':                     { iso: 'CN', name: 'China',                     lat:  35.86, lng: 104.20, region: 'Asia-Pacific' },
  'India':                     { iso: 'IN', name: 'India',                     lat:  20.59, lng:  78.96, region: 'Asia-Pacific' },
  'Indonesia':                 { iso: 'ID', name: 'Indonesia',                 lat:  -0.79, lng: 113.92, region: 'Asia-Pacific' },
  'Japan':                     { iso: 'JP', name: 'Japan',                     lat:  36.20, lng: 138.25, region: 'Asia-Pacific' },
  "Lao People's Democratic Republic": { iso: 'LA', name: 'Laos',               lat:  19.86, lng: 102.50, region: 'Asia-Pacific' },
  'Malaysia':                  { iso: 'MY', name: 'Malaysia',                  lat:   4.21, lng: 101.98, region: 'Asia-Pacific' },
  'Mongolia':                  { iso: 'MN', name: 'Mongolia',                  lat:  46.86, lng: 103.85, region: 'Asia-Pacific' },
  'Myanmar':                   { iso: 'MM', name: 'Myanmar',                   lat:  21.91, lng:  95.96, region: 'Asia-Pacific' },
  'Nepal':                     { iso: 'NP', name: 'Nepal',                     lat:  28.39, lng:  84.12, region: 'Asia-Pacific' },
  'Pakistan':                  { iso: 'PK', name: 'Pakistan',                  lat:  30.38, lng:  69.35, region: 'Asia-Pacific' },
  'Papua New Guinea':          { iso: 'PG', name: 'Papua New Guinea',          lat:  -6.31, lng: 143.96, region: 'Asia-Pacific' },
  'Philippines':               { iso: 'PH', name: 'Philippines',               lat:  12.88, lng: 121.77, region: 'Asia-Pacific' },
  'Republic of Korea':         { iso: 'KR', name: 'South Korea',               lat:  35.91, lng: 127.77, region: 'Asia-Pacific' },
  "Democratic People's Republic of Korea": { iso: 'KP', name: 'North Korea',   lat:  40.34, lng: 127.51, region: 'Asia-Pacific' },
  'Singapore':                 { iso: 'SG', name: 'Singapore',                 lat:   1.35, lng: 103.82, region: 'Asia-Pacific' },
  'Sri Lanka':                 { iso: 'LK', name: 'Sri Lanka',                 lat:   7.87, lng:  80.77, region: 'Asia-Pacific' },
  'Thailand':                  { iso: 'TH', name: 'Thailand',                  lat:  15.87, lng: 100.99, region: 'Asia-Pacific' },
  'Timor-Leste':               { iso: 'TL', name: 'Timor-Leste',               lat:  -8.87, lng: 125.73, region: 'Asia-Pacific' },
  'Viet Nam':                  { iso: 'VN', name: 'Vietnam',                   lat:  14.06, lng: 108.28, region: 'Asia-Pacific' },
  'Vietnam':                   { iso: 'VN', name: 'Vietnam',                   lat:  14.06, lng: 108.28, region: 'Asia-Pacific' },
  'New Zealand':               { iso: 'NZ', name: 'New Zealand',               lat: -40.90, lng: 174.89, region: 'Asia-Pacific' },

  // Middle East
  'Iran (Islamic Republic of)':{ iso: 'IR', name: 'Iran',                      lat:  32.43, lng:  53.69, region: 'Middle East' },
  'Iraq':                      { iso: 'IQ', name: 'Iraq',                      lat:  33.22, lng:  43.68, region: 'Middle East' },
  'Israel':                    { iso: 'IL', name: 'Israel',                    lat:  31.05, lng:  34.85, region: 'Middle East' },
  'Jordan':                    { iso: 'JO', name: 'Jordan',                    lat:  30.59, lng:  36.24, region: 'Middle East' },
  'Kuwait':                    { iso: 'KW', name: 'Kuwait',                    lat:  29.31, lng:  47.48, region: 'Middle East' },
  'Lebanon':                   { iso: 'LB', name: 'Lebanon',                   lat:  33.85, lng:  35.86, region: 'Middle East' },
  'Oman':                      { iso: 'OM', name: 'Oman',                      lat:  21.51, lng:  55.92, region: 'Middle East' },
  'Qatar':                     { iso: 'QA', name: 'Qatar',                     lat:  25.35, lng:  51.18, region: 'Middle East' },
  'Saudi Arabia':              { iso: 'SA', name: 'Saudi Arabia',              lat:  23.89, lng:  45.08, region: 'Middle East' },
  'Kingdom of Saudi Arabia':   { iso: 'SA', name: 'Saudi Arabia',              lat:  23.89, lng:  45.08, region: 'Middle East' },
  'Syrian Arab Republic':      { iso: 'SY', name: 'Syria',                     lat:  34.80, lng:  38.99, region: 'Middle East' },
  'Türkiye':                   { iso: 'TR', name: 'Türkiye',                   lat:  38.96, lng:  35.24, region: 'Middle East' },
  'Turkey':                    { iso: 'TR', name: 'Türkiye',                   lat:  38.96, lng:  35.24, region: 'Middle East' },
  'United Arab Emirates':      { iso: 'AE', name: 'UAE',                       lat:  23.42, lng:  53.85, region: 'Middle East' },
  'Yemen':                     { iso: 'YE', name: 'Yemen',                     lat:  15.55, lng:  48.52, region: 'Middle East' },

  // Europe
  'Austria':                   { iso: 'AT', name: 'Austria',                   lat:  47.52, lng:  14.55, region: 'Europe' },
  'Belgium':                   { iso: 'BE', name: 'Belgium',                   lat:  50.50, lng:   4.47, region: 'Europe' },
  'Bulgaria':                  { iso: 'BG', name: 'Bulgaria',                  lat:  42.73, lng:  25.49, region: 'Europe' },
  'Czechia':                   { iso: 'CZ', name: 'Czechia',                   lat:  49.82, lng:  15.47, region: 'Europe' },
  'Denmark':                   { iso: 'DK', name: 'Denmark',                   lat:  56.26, lng:   9.50, region: 'Europe' },
  'Finland':                   { iso: 'FI', name: 'Finland',                   lat:  61.92, lng:  25.75, region: 'Europe' },
  'France':                    { iso: 'FR', name: 'France',                    lat:  46.23, lng:   2.21, region: 'Europe' },
  'Germany':                   { iso: 'DE', name: 'Germany',                   lat:  51.17, lng:  10.45, region: 'Europe' },
  'Greece':                    { iso: 'GR', name: 'Greece',                    lat:  39.07, lng:  21.82, region: 'Europe' },
  'Hungary':                   { iso: 'HU', name: 'Hungary',                   lat:  47.16, lng:  19.50, region: 'Europe' },
  'Ireland':                   { iso: 'IE', name: 'Ireland',                   lat:  53.41, lng:  -8.24, region: 'Europe' },
  'Italy':                     { iso: 'IT', name: 'Italy',                     lat:  41.87, lng:  12.57, region: 'Europe' },
  'Netherlands':               { iso: 'NL', name: 'Netherlands',               lat:  52.13, lng:   5.29, region: 'Europe' },
  'Norway':                    { iso: 'NO', name: 'Norway',                    lat:  60.47, lng:   8.47, region: 'Europe' },
  'Poland':                    { iso: 'PL', name: 'Poland',                    lat:  51.92, lng:  19.15, region: 'Europe' },
  'Portugal':                  { iso: 'PT', name: 'Portugal',                  lat:  39.40, lng:  -8.22, region: 'Europe' },
  'Romania':                   { iso: 'RO', name: 'Romania',                   lat:  45.94, lng:  24.97, region: 'Europe' },
  'Russian Federation':        { iso: 'RU', name: 'Russia',                    lat:  61.52, lng: 105.32, region: 'Europe' },
  'Spain':                     { iso: 'ES', name: 'Spain',                     lat:  40.46, lng:  -3.75, region: 'Europe' },
  'Sweden':                    { iso: 'SE', name: 'Sweden',                    lat:  60.13, lng:  18.64, region: 'Europe' },
  'Switzerland':               { iso: 'CH', name: 'Switzerland',               lat:  46.82, lng:   8.23, region: 'Europe' },
  'Ukraine':                   { iso: 'UA', name: 'Ukraine',                   lat:  48.38, lng:  31.17, region: 'Europe' },
  'United Kingdom':            { iso: 'GB', name: 'United Kingdom',            lat:  55.38, lng:  -3.44, region: 'Europe' },

  // Americas
  'Argentina':                 { iso: 'AR', name: 'Argentina',                 lat: -38.42, lng: -63.62, region: 'South America' },
  'Barbados':                  { iso: 'BB', name: 'Barbados',                  lat:  13.19, lng: -59.54, region: 'North America' },
  'the Plurinational State of Bolivia': { iso: 'BO', name: 'Bolivia',         lat: -16.29, lng: -63.59, region: 'South America' },
  'Bolivia':                   { iso: 'BO', name: 'Bolivia',                   lat: -16.29, lng: -63.59, region: 'South America' },
  'Brazil':                    { iso: 'BR', name: 'Brazil',                    lat: -14.24, lng: -51.93, region: 'South America' },
  'Canada':                    { iso: 'CA', name: 'Canada',                    lat:  56.13, lng: -106.35, region: 'North America' },
  'Chile':                     { iso: 'CL', name: 'Chile',                     lat: -35.68, lng: -71.54, region: 'South America' },
  'Colombia':                  { iso: 'CO', name: 'Colombia',                  lat:   4.57, lng: -74.30, region: 'South America' },
  'Costa Rica':                { iso: 'CR', name: 'Costa Rica',                lat:   9.75, lng: -83.75, region: 'North America' },
  'Cuba':                      { iso: 'CU', name: 'Cuba',                      lat:  21.52, lng: -77.78, region: 'North America' },
  'Dominican Republic':        { iso: 'DO', name: 'Dominican Republic',        lat:  18.74, lng: -70.16, region: 'North America' },
  'Ecuador':                   { iso: 'EC', name: 'Ecuador',                   lat:  -1.83, lng: -78.18, region: 'South America' },
  'El Salvador':               { iso: 'SV', name: 'El Salvador',               lat:  13.79, lng: -88.90, region: 'North America' },
  'Guatemala':                 { iso: 'GT', name: 'Guatemala',                 lat:  15.78, lng: -90.23, region: 'North America' },
  'Haiti':                     { iso: 'HT', name: 'Haiti',                     lat:  18.97, lng: -72.29, region: 'North America' },
  'Honduras':                  { iso: 'HN', name: 'Honduras',                  lat:  15.20, lng: -86.24, region: 'North America' },
  'Mexico':                    { iso: 'MX', name: 'Mexico',                    lat:  23.63, lng: -102.55, region: 'North America' },
  'Nicaragua':                 { iso: 'NI', name: 'Nicaragua',                 lat:  12.87, lng: -85.21, region: 'North America' },
  'Panama':                    { iso: 'PA', name: 'Panama',                    lat:   8.54, lng: -80.78, region: 'North America' },
  'Paraguay':                  { iso: 'PY', name: 'Paraguay',                  lat: -23.44, lng: -58.44, region: 'South America' },
  'Peru':                      { iso: 'PE', name: 'Peru',                      lat:  -9.19, lng: -75.02, region: 'South America' },
  'United States of America':  { iso: 'US', name: 'United States',             lat:  39.83, lng: -98.58, region: 'North America' },
  'Uruguay':                   { iso: 'UY', name: 'Uruguay',                   lat: -32.52, lng: -55.77, region: 'South America' },
  'Venezuela':                 { iso: 'VE', name: 'Venezuela',                 lat:   6.42, lng: -66.59, region: 'South America' },

  // Regional fallbacks — placed at a representative regional centroid
  'African Region':                { iso: 'AFR', name: 'African Region',           lat:   0.00, lng:  18.00, region: 'Africa' },
  'African Region (AFRO)':         { iso: 'AFR', name: 'African Region',           lat:   0.00, lng:  18.00, region: 'Africa' },
  'Region of the Americas':        { iso: 'AMR', name: 'Americas Region',          lat:   8.00, lng: -75.00, region: 'South America' },
  'Eastern Mediterranean Region':  { iso: 'EMR', name: 'E. Mediterranean Region',  lat:  25.00, lng:  45.00, region: 'Middle East' },
  'European Region':               { iso: 'EUR', name: 'European Region',          lat:  50.00, lng:  15.00, region: 'Europe' },
  'South-East Asia Region':        { iso: 'SEAR',name: 'SE Asia Region',           lat:  10.00, lng:  90.00, region: 'Asia-Pacific' },
  'Western Pacific Region':        { iso: 'WPR', name: 'W. Pacific Region',        lat:   5.00, lng: 140.00, region: 'Asia-Pacific' },
  'La Réunion':                    { iso: 'RE', name: 'La Réunion',                lat: -21.11, lng:  55.54, region: 'Africa' },
  'Mayotte':                       { iso: 'YT', name: 'Mayotte',                   lat: -12.83, lng:  45.17, region: 'Africa' },
  'Northern Hemisphere':           { iso: 'NHEM', name: 'Northern Hemisphere',     lat:  45.00, lng:  20.00, region: 'Global' },
  // Park "global" + "multi-country" labels in the mid-Atlantic away from any
  // real country marker so they don't stack on null-island.
  'Global situation':              { iso: 'GLOB', name: 'Global situation',        lat: -10.00, lng: -25.00, region: 'Global' },
  'Global Situation':              { iso: 'GLOB', name: 'Global situation',        lat: -10.00, lng: -25.00, region: 'Global' },
  'Global update':                 { iso: 'GLOB', name: 'Global situation',        lat: -10.00, lng: -25.00, region: 'Global' },
  'Multi-country':                 { iso: 'MULT', name: 'Multi-country',           lat: -15.00, lng: -35.00, region: 'Global' },
};

const DISEASE_FAMILY: Array<[RegExp, DiseaseFamily]> = [
  [/ebola|marburg|sudan virus|bundibugyo|lassa|crimean-congo|chapare|h(a|ae)morrhagic/i, 'vhf'],
  [/mpox|monkeypox/i, 'mpox'],
  [/avian influenza|h5n1|h5n2|h5n5|h9n2|h1n1|influenza|coronavirus|mers|covid|metapneumovirus|respiratory|sars|rsv/i, 'respiratory'],
  [/dengue|chikungunya|zika|yellow fever|oropouche|west nile|wnv|rift valley|rvf|nipah|japanese encephalitis|jev|hantavirus|chandipura|encephalitis/i, 'vector'],
  [/cholera|anthrax|meningococcal|diphtheria|plague|legionella|listeria|salmonella|botulism|klebsiella|antimicrobial|legionnaires/i, 'bacterial'],
  [/polio|measles|rubella|mumps|pertussis|tetanus/i, 'vpd'],
];

function diseaseFamily(disease: string): DiseaseFamily {
  for (const [rx, fam] of DISEASE_FAMILY) if (rx.test(disease)) return fam;
  return 'other';
}

// Match the disease/location split — WHO uses ASCII -, en-dash –, and minus.
// We split on the LAST occurrence so multi-word disease names survive.
function splitTitle(title: string): { disease: string; location: string } {
  // Find last dash-separator with optional spaces around it.
  // Prefer ' - ', ' – ', then '- ' or '– ' tight (handle "Marburg- Ethiopia")
  const match = title.match(/^(.*?)(?:\s[\-–]\s|\s[\-–]|[\-–]\s|,\s)([^,]+)$/);
  if (match) {
    return { disease: match[1].trim().replace(/,$/, ''), location: match[2].trim() };
  }
  return { disease: title, location: '' };
}

// "Country A & Country B" / "Country A and Country B" → array
function splitLocations(loc: string): string[] {
  return loc.split(/\s+(?:&|and)\s+/i).map(s => s.trim()).filter(Boolean);
}

function resolveCountry(loc: string): CountryCoord | null {
  // Direct hit
  if (COUNTRIES[loc]) return COUNTRIES[loc];
  // Try stripping "the " prefix and trailing punctuation
  const cleaned = loc.replace(/^the\s+/i, '').replace(/[.,;:!?\s]+$/g, '').trim();
  if (COUNTRIES[cleaned]) return COUNTRIES[cleaned];
  // Substring match — last resort, allow case-insensitive contains
  const lower = cleaned.toLowerCase();
  for (const [k, v] of Object.entries(COUNTRIES)) {
    if (lower === k.toLowerCase()) return v;
  }
  for (const [k, v] of Object.entries(COUNTRIES)) {
    if (lower.includes(k.toLowerCase()) && k.length > 4) return v;
  }
  return null;
}

interface RawDon {
  Id: string;
  PublicationDate: string;
  Title: string;
  ItemDefaultUrl: string;
  UrlName?: string;
  Summary?: string;
  Overview?: string;
}

interface OutbreakEntry {
  title: string;
  disease: string;
  family: DiseaseFamily;
  published: string;
  days_ago: number;
  url: string;
  summary: string;
}

interface CountryMarker {
  iso: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  is_regional: boolean;
  count: number;
  most_recent_days_ago: number;
  most_recent_date: string;
  dominant_family: DiseaseFamily;
  diseases: string[];
  entries: OutbreakEntry[];
}

interface Payload { markers: CountryMarker[]; total_reports: number; period_days: number; built_at: string; }

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=14400' } },
    );
  }

  try {
    const res = await fetch(whoUrl(), {
      signal: AbortSignal.timeout(20000),
      // Next 16 fetch wrapper adds headers WHO's CDN doesn't like; bypass cache
      // and send a normal browser UA + Accept.
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 OSIRIS/1.0',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`WHO API ${res.status}`);
    const json = await res.json();
    const items: RawDon[] = Array.isArray(json.value) ? json.value : [];

    const now = Date.now();
    // Aggregate per resolved-country
    const byCountry = new Map<string, CountryMarker>();
    let totalParsed = 0;
    let oldestKept = 0;

    for (const it of items) {
      const { disease, location } = splitTitle(it.Title);
      if (!location) continue;
      // Multi-location titles → fan-out
      const locs = splitLocations(location);
      const published = it.PublicationDate;
      const days = Math.floor((now - new Date(published).getTime()) / 86400000);
      const family = diseaseFamily(disease);
      const summary = (it.Summary || '').replace(/<[^>]*>/g, '').trim().slice(0, 400);

      for (const locStr of locs) {
        const country = resolveCountry(locStr);
        if (!country) continue;
        totalParsed++;
        oldestKept = Math.max(oldestKept, days);
        const key = country.iso;
        if (!byCountry.has(key)) {
          byCountry.set(key, {
            iso: country.iso, name: country.name, region: country.region,
            lat: country.lat, lng: country.lng,
            is_regional: country.iso.length > 2,
            count: 0, most_recent_days_ago: 99999, most_recent_date: '',
            dominant_family: family, diseases: [], entries: [],
          });
        }
        const marker = byCountry.get(key)!;
        marker.count++;
        marker.entries.push({
          title: it.Title, disease: disease, family, published,
          days_ago: days,
          url: `https://www.who.int/emergencies/disease-outbreak-news/item/${it.UrlName || it.ItemDefaultUrl.replace(/^\//, '')}`,
          summary,
        });
        if (days < marker.most_recent_days_ago) {
          marker.most_recent_days_ago = days;
          marker.most_recent_date = published;
        }
        if (!marker.diseases.includes(disease)) marker.diseases.push(disease);
      }
    }

    // Set dominant family = most common family across this country's reports
    for (const m of byCountry.values()) {
      const fc: Record<string, number> = {};
      for (const e of m.entries) fc[e.family] = (fc[e.family] || 0) + 1;
      m.dominant_family = (Object.entries(fc).sort((a, b) => b[1] - a[1])[0]?.[0] as DiseaseFamily) || 'other';
      m.entries.sort((a, b) => a.days_ago - b.days_ago);
    }

    const markers = [...byCountry.values()].sort((a, b) => a.most_recent_days_ago - b.most_recent_days_ago);
    const payload: Payload = { markers, total_reports: totalParsed, period_days: oldestKept, built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=14400' } },
    );
  } catch (e) {
    const stale = await cacheReadStale<Payload>(CACHE_KEY);
    if (stale) {
      return NextResponse.json(
        { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000) },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch WHO outbreak data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
