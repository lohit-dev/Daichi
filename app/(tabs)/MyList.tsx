import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavedAnimesStore } from '~/app/_store/useSavedAnimesStore';
import AnimeCard from '~/components/shared/AnimeCard';
import { getFormattedTitle } from '~/helpers/TextFormat';

const MyList = () => {
  const savedAnimes = useSavedAnimesStore((s) => s.animes);

  const { width: screenWidth } = useWindowDimensions();
  const gridGap = 8;
  const cardWidth = (screenWidth - 32 - gridGap * 2) / 3;

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-neutral-950">
      <View className="relative">
        <LinearGradient
          colors={['rgba(163, 230, 53, 0.2)', 'transparent']}
          className="absolute h-72 w-full rounded-full"
        />
      </View>
      <FlatList
        data={savedAnimes}
        numColumns={3}
        keyExtractor={(item) => item.slug}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 16 }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        ListHeaderComponent={
          <View className="mt-16 items-center px-6 pt-8">
            <Text className="font-salsa pt-6 text-5xl text-white">
              {getFormattedTitle('My Library', 'text-5xl font-salsa font-semibold')}
            </Text>
            <Text className="font-salsa mt-2 text-lg text-neutral-400">
              {getFormattedTitle(
                `${savedAnimes.length} Saved Anime`,
                'text-lg font-salsa font-semibold'
              )}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown} className="mb-4" style={{ width: cardWidth }}>
            <AnimeCard item={item} index={index} width={cardWidth - 16} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <Animated.View
            entering={FadeInDown.delay(300)}
            className="items-center justify-center p-8 pt-20">
            <Text className="font-salsa text-center text-2xl text-neutral-400">
              Your library is empty{'\n'}Add some anime to get started!
            </Text>
          </Animated.View>
        }
      />
    </SafeAreaView>
  );
};

export default MyList;
