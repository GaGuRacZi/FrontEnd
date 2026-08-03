const REGION_ALIASES: Record<string, string> = {
  강원도: '강원',
  강원특별자치도: '강원',
  경기: '경기',
  경기도: '경기',
  경남: '경남',
  경상남도: '경남',
  경북: '경북',
  경상북도: '경북',
  광주: '광주',
  광주광역시: '광주',
  대구: '대구',
  대구시: '대구',
  대구광역시: '대구',
  대전: '대전',
  대전시: '대전',
  대전광역시: '대전',
  부산: '부산',
  부산시: '부산',
  부산광역시: '부산',
  서울: '서울',
  서울시: '서울',
  서울특별시: '서울',
  세종: '세종시',
  세종시: '세종시',
  세종특별자치시: '세종시',
  울산: '울산',
  울산시: '울산',
  울산광역시: '울산',
  인천: '인천',
  인천시: '인천',
  인천광역시: '인천',
  전남: '전남',
  전라남도: '전남',
  전북: '전북',
  전라북도: '전북',
  전북특별자치도: '전북',
  제주: '제주',
  제주도: '제주',
  제주특별자치도: '제주',
  충남: '충남',
  충청남도: '충남',
  충북: '충북',
  충청북도: '충북',
};

const METROPOLITAN_REGIONS = new Set([
  '광주',
  '대구',
  '대전',
  '부산',
  '서울',
  '세종시',
  '울산',
  '인천',
]);

const COUNTRY_NAMES = new Set(['대한민국', '한국']);
const REGION_NAMES = Object.keys(REGION_ALIASES);

function getFirstToken(tokens: string[], pattern: RegExp, startIndex: number) {
  return tokens.slice(startIndex).find((token) => pattern.test(token));
}

function joinRegion(...parts: (string | undefined)[]) {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

export function formatCompactRegion(value?: string | null) {
  const fallbackValue = (value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
  const normalized = fallbackValue
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[,]/g, ' ')
    .replace(/^(?:Republic of Korea|South Korea)\s+/i, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) return '';

  const rawTokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        !COUNTRY_NAMES.has(token) &&
        !/^\d{5}$/.test(token),
  );
  if (!rawTokens.length) return normalized;

  if (
    !REGION_ALIASES[rawTokens[0]] &&
    REGION_NAMES.some(
      (regionName) =>
        rawTokens[0] !== regionName && rawTokens[0].startsWith(regionName),
    )
  ) {
    return fallbackValue;
  }

  const tokens = rawTokens
    .map((token) => REGION_ALIASES[token] ?? token)
    .filter((token, index, values) => values.indexOf(token) === index);
  const topLevel = REGION_ALIASES[rawTokens[0]];
  const startIndex = topLevel ? 1 : 0;
  const roadIndex = tokens.findIndex(
    (token, index) =>
      index >= startIndex &&
      (/^\d+(?:-\d+)?(?:번지)?$/.test(token) || /(?:대로|로|길)$/.test(token)),
  );
  const administrativeTokens = roadIndex < 0 ? tokens : tokens.slice(0, roadIndex);
  const city = getFirstToken(administrativeTokens, /시$/, startIndex);
  const district = getFirstToken(administrativeTokens, /구$/, startIndex);
  const county = getFirstToken(administrativeTokens, /군$/, startIndex);
  const town = getFirstToken(administrativeTokens, /[읍면]$/, startIndex);
  const neighborhood = getFirstToken(administrativeTokens, /동$/, startIndex);

  if (topLevel === '세종시') return topLevel;

  if (county) {
    return joinRegion(county, town);
  }

  if (topLevel && METROPOLITAN_REGIONS.has(topLevel) && district) {
    return joinRegion(topLevel, district);
  }

  if (city && district) {
    return joinRegion(city, district);
  }

  if (city) {
    if (town || neighborhood) {
      return joinRegion(city, town ?? neighborhood);
    }

    return city;
  }

  if (district) {
    return joinRegion(topLevel, district);
  }

  if (topLevel) return topLevel;

  return fallbackValue;
}
