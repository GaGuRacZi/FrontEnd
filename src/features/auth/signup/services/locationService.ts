import * as Location from 'expo-location';

export const MAX_LOCATION_ACCURACY_METERS = 500;

function getCurrentPosition() {
  return new Promise<Location.LocationObject>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), 15000);

    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    }).then(
      (position) => {
        clearTimeout(timeoutId);
        resolve(position);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
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

export async function getRegionFromPosition(position: Location.LocationObject) {
  const addresses = await Location.reverseGeocodeAsync(position.coords);
  const address = addresses[0];

  if (!address) return '';

  const values = [address.region, address.city, address.district, address.subregion];
  const isForeign = address.isoCountryCode
    ? address.isoCountryCode.toUpperCase() !== 'KR'
    : !values.some((value) => /[가-힣]/.test(value ?? ''));
  const cityValue = [address.city, address.district, address.subregion].find(
    (value): value is string => Boolean(value?.trim()),
  );
  const parts = (isForeign ? [cityValue, address.region] : values).filter(
    (part): part is string => Boolean(part?.trim()),
  );
  const region = parts
    .filter((part, index) => parts.indexOf(part) === index)
    .join(isForeign ? ', ' : ' ');

  return region || address.formattedAddress || address.name || '';
}
