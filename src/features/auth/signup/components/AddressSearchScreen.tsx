import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { LoadingView } from '@/src/components/common/LoadingView';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { TopHeader } from '@/src/components/layout/TopHeader';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AddressSearchScreenProps = {
  onBack: () => void;
  onSelect: (address: string) => void;
};

const KAKAO_POSTCODE_ORIGIN = 'https://postcode.map.kakao.com';

function isAllowedNavigation(url: string) {
  return (
    url === 'about:blank' ||
    url === KAKAO_POSTCODE_ORIGIN ||
    url.startsWith(`${KAKAO_POSTCODE_ORIGIN}/`) ||
    url.startsWith(`${KAKAO_POSTCODE_ORIGIN}?`) ||
    url.startsWith(`${KAKAO_POSTCODE_ORIGIN}#`)
  );
}

const KAKAO_POSTCODE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body, #postcode { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: ${COLORS.background}; }
    </style>
  </head>
  <body>
    <div id="postcode"></div>
    <script>
      function sendMessage(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function startPostcode() {
        if (!window.kakao || !window.kakao.Postcode) {
          sendMessage({ type: 'error' });
          return;
        }

        var postcode = new window.kakao.Postcode({
          oncomplete: function(data) {
            var address = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
            sendMessage({
              type: 'selected',
              address: address || data.address
            });
          },
          onresize: function() {
            sendMessage({ type: 'ready' });
          },
          width: '100%',
          height: '100%',
          maxSuggestItems: 5
        });

        postcode.embed(document.getElementById('postcode'));
        sendMessage({ type: 'ready' });
      }
    </script>
    <script
      src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      onload="startPostcode()"
      onerror="sendMessage({ type: 'error' })"
    ></script>
  </body>
</html>`;

export function AddressSearchScreen({ onBack, onSelect }: AddressSearchScreenProps) {
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  useEffect(() => {
    if (ready || loadError) return;

    const timeoutId = setTimeout(() => setLoadError(true), 15000);

    return () => clearTimeout(timeoutId);
  }, [loadError, ready, reloadKey]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as unknown;

      if (typeof message !== 'object' || message === null || !('type' in message)) {
        setLoadError(true);
        return;
      }

      if (
        message.type === 'selected' &&
        'address' in message &&
        typeof message.address === 'string'
      ) {
        const address = message.address.trim();

        if (address) {
          onSelect(address);
          return;
        }
      }

      if (message.type === 'ready') {
        setReady(true);
        setLoadError(false);
        return;
      }

      setLoadError(true);
    } catch {
      setLoadError(true);
    }
  };

  const retry = () => {
    setLoadError(false);
    setReady(false);
    setReloadKey((current) => current + 1);
  };

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']} padded={false}>
      <TopHeader
        leftAccessibilityLabel="위치 정보 화면으로 돌아가기"
        leftIcon="chevron-back"
        onLeftPress={onBack}
        style={styles.header}
        title="지역 검색"
      />
      <View style={styles.webViewContainer}>
        <WebView
          cacheEnabled
          domStorageEnabled
          javaScriptEnabled
          key={reloadKey}
          mixedContentMode="never"
          onError={() => setLoadError(true)}
          onHttpError={() => setLoadError(true)}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={({ url }) => isAllowedNavigation(url)}
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          source={{
            baseUrl: KAKAO_POSTCODE_ORIGIN,
            html: KAKAO_POSTCODE_HTML,
          }}
          style={styles.webView}
          textZoom={100}
        />

        {!ready && !loadError ? (
          <View style={styles.loadingOverlay}>
            <LoadingView label="주소 검색을 불러오고 있어요." />
          </View>
        ) : null}

        {loadError ? (
          <View style={styles.error}>
            <AppIcon color={COLORS.gray500} name="cloud-offline-outline" size={44} />
            <Text style={styles.errorTitle}>주소 검색을 불러오지 못했어요.</Text>
            <Text style={styles.errorDescription}>인터넷 연결을 확인해주세요.</Text>
            <AppButton
              fullWidth={false}
              onPress={retry}
              size="medium"
              style={styles.retryButton}
              title="다시 시도"
            />
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: SPACING.xxl,
  },
  webViewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  errorTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    marginTop: SPACING.xxl,
  },
  errorDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  retryButton: {
    height: 46,
    marginTop: SPACING.xxxl,
  },
});
