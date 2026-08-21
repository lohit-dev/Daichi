import { useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ScalePressable from './ScalePressable';

import { getFormattedTitle } from '~/helpers/TextFormat';

type ScreenHeaderProps = {
  title: string;
};

export default function ScreenHeader({ title }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className="flex-row items-center justify-between border-b border-white/10 px-4 py-3">
      <ScalePressable
        onPress={() => router.back()}
        className="h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
        scaleTo={0.85}
        accessibilityLabel="Go back">
        <ArrowLeft2 size={22} color="#fff" />
      </ScalePressable>

      <Text className="mx-2 flex-1 text-center text-white" style={styles.title} numberOfLines={1}>
        {getFormattedTitle(title)}
      </Text>

      {/* Right spacer keeps title centred */}
      <View className="h-10 w-10" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'Salsa-Regular',
    fontSize: 22,
  },
});
