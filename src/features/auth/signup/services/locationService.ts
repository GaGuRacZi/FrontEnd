import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { resolveRemoteLocation } from '@/src/services/locationApi';

export const MAX_LOCATION_ACCURACY_METERS = 500;
const LOCATION_TIMEOUT_MS = 15000;

export class LocationPermissionError extends Error {
  constructor() {
    super('Location permission is required.');
    this.name = 'LocationPermissionError';
  }
}

function withLocationTimeout<T>(request: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error('LOCATION_TIMEOUT')),
      LOCATION_TIMEOUT_MS,
    );

    request.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function getCurrentPosition() {
  return withLocationTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    }),
  );
}

export async function geocodeAddress(address: string) {
  if (Platform.OS === 'android') {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new LocationPermissionError();
  }

  return withLocationTimeout(Location.geocodeAsync(address));
}

export async function getBestCurrentPosition() {
  try {
    return await getCurrentPosition();
  } catch {
    return Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: MAX_LOCATION_ACCURACY_METERS,
    });
  }
}

export async function getRegionFromCoordinates(latitude: number, longitude: number) {
  return (await resolveRemoteLocation(latitude, longitude)).regionName;
}

export async function getRegionFromPosition(position: Location.LocationObject) {
  return getRegionFromCoordinates(
    position.coords.latitude,
    position.coords.longitude,
  );
}
