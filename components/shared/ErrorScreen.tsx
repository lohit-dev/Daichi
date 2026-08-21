import LottieView from 'lottie-react-native';
import { Text, View } from 'react-native';

import ScalePressable from './ScalePressable';

import { hp, wp } from '~/helpers/common';

type ErrorScreenProps = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-8">
      <LottieView
        source={require('~/assets/lottie/Error.json')}
        autoPlay
        loop
        style={{ height: hp(34), width: wp(70) }}
      />
      {message ? <Text className="text-center text-base text-white/70">{message}</Text> : null}
      {onRetry ? (
        <ScalePressable
          onPress={onRetry}
          className="rounded-xl bg-lime-200 px-6 py-3"
          haptic="medium">
          <Text className="text-[15px] font-bold text-[#182008]">Retry</Text>
        </ScalePressable>
      ) : null}
    </View>
  );
}
