require('@expo/env').load(__dirname, { silent: true });

const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;
const hasKakaoAppKey = /^[a-f0-9]{32}$/i.test(kakaoAppKey ?? '');

if (
  !hasKakaoAppKey &&
  !(process.env.EXPO_NO_DOTENV && !process.env.EAS_BUILD && !kakaoAppKey)
) {
  throw new Error('KAKAO_NATIVE_APP_KEY must be a 32-character hexadecimal value.');
}

module.exports = ({ config }) => {
  const configuredPluginNames = new Set([
    '@react-native-seoul/kakao-login',
    'expo-build-properties',
  ]);
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !configuredPluginNames.has(name);
  });

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    },
    plugins: [
      ...plugins,
      ...(hasKakaoAppKey
        ? [['@react-native-seoul/kakao-login', { kakaoAppKey }]]
        : []),
      [
        'expo-build-properties',
        {
          android: {
            extraMavenRepos: [
              'https://devrepo.kakao.com/nexus/content/groups/public/',
            ],
          },
        },
      ],
    ],
  };
};
