import { useQueryClient } from '@tanstack/react-query';
import { ArrowSwapHorizontal, Refresh2 } from 'iconsax-react-native';
import LottieView from 'lottie-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { useToast } from 'react-native-toast-notifications';

import ScalePressable from './ScalePressable';

import { useSettingsStore } from '~/app/_store/useSettingsStore';
import { hp, wp } from '~/helpers/common';

type ErrorScreenProps = {
  message?: string;
  onRetry?: () => void;
  showSwitchProvider?: boolean;
};

export default function ErrorScreen({
  message = 'An unexpected error occurred.',
  onRetry,
  showSwitchProvider = true,
}: ErrorScreenProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const provider = useSettingsStore((s) => s.provider);
  const setProvider = useSettingsStore((s) => s.setProvider);

  const handleSwitchProvider = async () => {
    const targetProvider = provider === 'kitsu' ? 'anilist' : 'kitsu';
    setProvider(targetProvider);

    toast?.show(
      targetProvider === 'kitsu'
        ? 'Switched to Kitsu API as default source'
        : 'Switched to AniList API',
      {
        type: 'success',
        placement: 'bottom',
        duration: 2500,
      }
    );

    // Invalidate queries so that the current screen and app re-fetch with new provider
    await queryClient.invalidateQueries();
    onRetry?.();
  };

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-8">
      <LottieView
        source={require('~/assets/lottie/Error.json')}
        autoPlay
        loop
        style={{ height: hp(34), width: wp(70) }}
      />
      <Text className="mt-3 text-center text-xl text-white">{message}</Text>

      <View className="mt-4 w-full max-w-[320px] flex-col items-center gap-3">
        {showSwitchProvider && (
          <ScalePressable
            onPress={handleSwitchProvider}
            className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3.5"
            haptic="medium">
            <ArrowSwapHorizontal size={18} color="#182008" variant="Bold" />
            <Text className="text-[15px] font-bold text-[#182008]">
              {provider === 'kitsu' ? 'Switch to AniList' : 'Switch to Kitsu'}
            </Text>
          </ScalePressable>
        )}

        {onRetry && (
          <ScalePressable
            onPress={onRetry}
            className="w-full flex-row items-center justify-center gap-2 rounded-xl border border-white/20 bg-neutral-900 px-6 py-3"
            haptic="medium">
            <Refresh2 size={16} color="#ffffff" variant="Linear" />
            <Text className="text-[14px] font-semibold text-white">Retry</Text>
          </ScalePressable>
        )}
      </View>
    </View>
  );
}
