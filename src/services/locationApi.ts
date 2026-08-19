import { apiRequest } from './apiClient';

export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
  regionCode: string;
  regionName: string;
};

export type RegionSearchResult = {
  code: string;
  dongPreview: string[];
  name: string;
};

export class LocationApiContractError extends Error {
  constructor() {
    super('Invalid location API response.');
    this.name = 'LocationApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LocationApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new LocationApiContractError();
  return value.trim();
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new LocationApiContractError();
  }
  return envelope.result;
}

function readResolvedLocation(value: unknown): ResolvedLocation {
  const location = readRecord(value);
  const latitude = location.latitude;
  const longitude = location.longitude;

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    throw new LocationApiContractError();
  }

  return {
    address: readString(location.address),
    latitude,
    longitude,
    regionCode: readString(location.regionCode),
    regionName: readString(location.regionName),
  };
}

function createLocationQuery(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new LocationApiContractError();
  }
  return `lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`;
}

export function parseResolvedLocationEnvelope(value: unknown, expectedCode: string) {
  return readResolvedLocation(readEnvelope(value, expectedCode));
}

export function parseRegionSearchEnvelope(value: unknown): RegionSearchResult[] {
  const result = readEnvelope(value, 'REGION_SEARCH_200');
  if (!Array.isArray(result)) throw new LocationApiContractError();

  return result.map((value) => {
    const region = readRecord(value);
    if (!Array.isArray(region.dongPreview) || !region.dongPreview.every((item) => typeof item === 'string')) {
      throw new LocationApiContractError();
    }
    return {
      code: readString(region.code),
      dongPreview: region.dongPreview.map((item) => item.trim()).filter(Boolean),
      name: readString(region.name),
    };
  });
}

export async function getRemoteUserLocation() {
  const response = await apiRequest<unknown>('/location/user');
  return parseResolvedLocationEnvelope(response, 'LOCATION_200_1');
}

export async function certifyRemoteUserLocation(latitude: number, longitude: number) {
  const response = await apiRequest<unknown>(`/location/user/cert?${createLocationQuery(latitude, longitude)}`, {
    method: 'POST',
  });
  return parseResolvedLocationEnvelope(response, 'LOCATION_200_2');
}

export async function resolveRemoteLocation(latitude: number, longitude: number) {
  const response = await apiRequest<unknown>(`/location/resolve?${createLocationQuery(latitude, longitude)}`);
  return parseResolvedLocationEnvelope(response, 'LOCATION_200_4');
}

export async function searchRemoteRegions(query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const response = await apiRequest<unknown>(`/regions/search?q=${encodeURIComponent(normalizedQuery)}`, {
    authenticated: false,
  });
  return parseRegionSearchEnvelope(response);
}
