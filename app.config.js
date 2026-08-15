require('@expo/env').load(__dirname, { silent: true });

const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;

if (!/^[a-f0-9]{32}$/i.test(kakaoAppKey ?? '')) {
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
    plugins: [
      ...plugins,
      ['@react-native-seoul/kakao-login', { kakaoAppKey }],
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
