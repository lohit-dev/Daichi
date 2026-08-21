import LottieView from 'lottie-react-native';
import { View } from 'react-native';

import { hp, wp } from '~/helpers/common';

export default function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-950">
      <LottieView
        source={require('~/assets/lottie/loading.json')}
        autoPlay
        loop
        style={{ height: hp(40), width: wp(45) }}
      />
    </View>
  );
}
