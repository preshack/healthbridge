// src/services/fqhc.ts
// FQHC (Federally Qualified Health Center) finder
import { FQHCProvider, Language } from '../types/index.js';
import fqhcData from '../data/fqhc_data.json';
import { RIGHTS_TEXT } from '../data/rights_text.js';

interface ZippoPlace {
  latitude: string;
  longitude: string;
  state: string;
  ['state abbreviation']?: string;
}

interface ZippoResponse {
  places: ZippoPlace[];
}

export async function findNearestFQHCs(zip: string, limit = 3): Promise<FQHCProvider[]> {
  const geo = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!geo.ok) throw new Error('Invalid ZIP code');

  const geoData = (await geo.json()) as ZippoResponse;
  const place = geoData.places?.[0];
  if (!place) throw new Error('Invalid ZIP code');

  const userLat = parseFloat(place.latitude);
  const userLng = parseFloat(place.longitude);
  const userState = (place['state abbreviation'] || '').toUpperCase();

  const scored = (fqhcData as FQHCProvider[])
    .map((p) => ({ ...p, distanceMiles: haversine(userLat, userLng, p.lat, p.lng) }))
    .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

  const sameState = userState
    ? scored.filter((p) => (p.state || '').toUpperCase() === userState)
    : [];
  const primary = sameState.length > 0 ? sameState : scored;
  const nearest = primary.slice(0, limit);

  // Avoid returning useless ultra-far matches.
  if (!nearest.some((p) => (p.distanceMiles || 9999) <= 120)) return [];

  return nearest;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatProviderResults(providers: FQHCProvider[], language: Language): string {
  if (!providers.length) {
    return language === 'es'
      ? 'No encontre clinicas comunitarias cercanas para ese ZIP.\n\nPrueba con un ZIP vecino o comparte ciudad + estado para buscar mejor.'
      : 'I could not find nearby community clinics for that ZIP.\n\nTry a nearby ZIP or share city + state so I can search better.';
  }

  let msg = '*Safe Community Health Centers Near You*\n\n';
  msg += '_These centers serve everyone and use sliding-fee pricing._\n\n';

  providers.forEach((p, i) => {
    msg += `*${i + 1}. ${p.name}* - ${p.distanceMiles!.toFixed(1)} miles\n`;
    msg += `${p.address}, ${p.city}, ${p.state} ${p.zip}\n`;
    msg += `${p.phone}\n`;
    msg += `Sliding fee: $0-$50 based on income\n`;
    msg += `https://maps.google.com/?q=${p.lat},${p.lng}\n\n`;
  });

  msg += '---\n';
  msg += RIGHTS_TEXT[language] || RIGHTS_TEXT.en;
  return msg;
}
