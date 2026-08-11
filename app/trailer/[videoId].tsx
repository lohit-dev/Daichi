import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ArrowLeft } from 'iconsax-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';

const TrailerScreen = () => {
  const router = useRouter();
  const { videoId, title } = useLocalSearchParams<{ videoId: string; title?: string }>();
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeTrailer = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/Home');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {
        // The screen is still usable in portrait when orientation cannot be changed.
      });

      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
          // See the matching landscape fallback above.
        });
      };
    }, [])
  );

  const handleStateChange = useCallback(
    (state: PLAYER_STATES) => {
      if (state === PLAYER_STATES.ENDED) closeTrailer();
    },
    [closeTrailer]
  );

  return (
    <View
      style={styles.screen}
      onLayout={({ nativeEvent: { layout } }) => {
        const nextSize = { width: Math.round(layout.width), height: Math.round(layout.height) };
        setPlayerSize((currentSize) =>
          currentSize.width === nextSize.width && currentSize.height === nextSize.height
            ? currentSize
            : nextSize
        );
      }}>
      {videoId && playerSize.width > 0 && playerSize.height > 0 ? (
        <YoutubePlayer
          height={playerSize.height}
          width={playerSize.width}
          videoId={videoId}
          play={shouldPlay}
          forceAndroidAutoplay
          onReady={() => {
            setIsReady(true);
            setShouldPlay(true);
          }}
          onError={(youtubeError: string) => setError(youtubeError)}
          onChangeState={handleStateChange}
          initialPlayerParams={{
            controls: true,
            preventFullScreen: true,
            rel: false,
          }}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
          viewContainerStyle={styles.player}
          webViewStyle={styles.player}
        />
      ) : null}

      {!isReady && !error ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator size="large" color="#bef264" />
          <Text style={styles.loadingText}>Loading trailer…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Trailer unavailable</Text>
          <Text style={styles.errorText}>
            YouTube could not load this trailer. Please try again later.
          </Text>
        </View>
      ) : null}

      <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={['left', 'top']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close trailer"
          hitSlop={12}
          onPress={closeTrailer}
          style={styles.closeButton}>
          <ArrowLeft color="#ffffff" size={26} />
        </Pressable>
        {title ? (
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  player: {
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  title: {
    maxWidth: '65%',
    marginLeft: 12,
    marginTop: 11,
    color: '#ffffff',
    fontFamily: 'Salsa-Regular',
    fontSize: 17,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#d1d5db',
    fontFamily: 'Salsa-Regular',
    fontSize: 16,
  },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#ffffff',
    fontFamily: 'Salsa-Regular',
    fontSize: 22,
  },
  errorText: {
    marginTop: 10,
    color: '#a3a3a3',
    fontFamily: 'Salsa-Regular',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default TrailerScreen;
