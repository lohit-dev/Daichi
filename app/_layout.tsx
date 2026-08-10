import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
// import * as Linking from 'expo-linking';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from 'react-native-toast-notifications';

import { useColorScheme } from '~/hooks/useColorScheme';
import { AniListRequestError } from '~/services/AniListService';
import 'react-native-reanimated';
import '../global.css';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof AniListRequestError && [400, 401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        if (error instanceof AniListRequestError && error.retryAfterMs) {
          return error.retryAfterMs;
        }
        return Math.min(1000 * 2 ** attemptIndex, 8000);
      },
    },
  },
});

// const prefix = Linking.createURL('/');

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'Salsa-Regular': require('../assets/fonts/Salsa-Regular.ttf'),
  });

  useEffect(() => {
    const setSystemBars = () => {
      try {
        if (Platform.OS === 'android') {
          NavigationBar.setHidden(true);
          NavigationBar.setStyle('light');
        }
      } catch (error) {
        console.error('Error setting navigation bar:', error);
      }
    };

    setSystemBars();
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const linking = {
    prefixes: ['animax://', 'https://animax.app'],
    config: {
      screens: {
        index: '',
        '(tabs)': {
          screens: {
            Home: '',
          },
        },
        'anime/[id]': 'anime/:id',
        'anime/watch/[episodeId]': 'anime/watch/:episodeId',
      },
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <StatusBar animated style="inverted" hidden />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                    initialParams={{ linking }}
                  />
                  <Stack.Screen name="browse/[category]" options={{ headerShown: false }} />
                  <Stack.Screen name="browse/list" options={{ headerShown: false }} />
                </Stack>
              </ThemeProvider>
            </ToastProvider>
          </QueryClientProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
