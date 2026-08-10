import { router } from 'expo-router';
import { FlatList, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import AnimeCard from '../shared/AnimeCard';
import ScalePressable from '../shared/ScalePressable';

import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { BrowseCategory } from '~/services/AniListService';
import { Anime } from '~/types';

type RowItemProps = {
  name: string;
  seeAll: boolean;
  data: Anime[] | undefined;
  category?: BrowseCategory;
  /** When provided, "View all" navigates to the static list screen with this data */
  staticData?: Anime[];
  className?: string;
  rounded?: boolean;
  testIdPrefix?: string;
};

const RowItem = ({
  name,
  seeAll = true,
  data,
  category,
  staticData,
  className,
  rounded = false,
  testIdPrefix,
}: RowItemProps) => {
  const roundedRenderItem = ({ item, index }: { item: Anime; index: number }) => {
    return (
      <Animated.View entering={FadeInRight.delay(index * 200).duration(500)}>
        <ScalePressable
          onPress={() => {
            router.push({ pathname: '/anime/[id]', params: { id: item.slug, poster: item.image } });
          }}
          className="flex px-2">
          <View className="overflow-hidden rounded-full">
            <ImageBackground
              source={{ uri: item.image }}
              className="flex items-center justify-center"
              style={styles.roundedImage}>
              <View className="absolute bottom-0 left-0 right-0 top-0 z-auto bg-black opacity-50" />
              <Text className="font-salsa text-5xl text-lime-400">{index + 1}</Text>
            </ImageBackground>
          </View>
        </ScalePressable>
      </Animated.View>
    );
  };

  return (
    <View className={className}>
      <View className="flex flex-row items-center justify-between p-4 pt-8">
        <Text className="font-salsa text-3xl font-semibold text-white">
          {getFormattedTitle(name)}
        </Text>
        {seeAll && (
          <ScalePressable
            onPress={() => {
              if (staticData?.length) {
                router.push({
                  pathname: '/browse/list',
                  params: {
                    title: encodeURIComponent(name),
                    data: encodeURIComponent(JSON.stringify(staticData)),
                  },
                });
              } else if (category) {
                router.push({
                  pathname: '/browse/[category]',
                  params: { category, title: encodeURIComponent(name) },
                });
              }
            }}>
            <Text className="font-salsa text-base text-lime-300">View all</Text>
          </ScalePressable>
        )}
      </View>
      <FlatList
        nestedScrollEnabled
        scrollEventThrottle={0.5}
        horizontal
        data={data}
        contentContainerClassName="px-2"
        showsHorizontalScrollIndicator={false}
        renderItem={
          rounded
            ? roundedRenderItem
            : ({ item, index }) => (
                <AnimeCard
                  item={item}
                  index={index}
                  testID={testIdPrefix ? `${testIdPrefix}-${index}` : undefined}
                />
              )
        }
        keyExtractor={(_, index) => index.toString()}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
      />
    </View>
  );
};

export default RowItem;

const styles = StyleSheet.create({
  Image: {
    width: wp(28),
    height: hp(19),
  },
  roundedImage: {
    width: wp(20),
    height: wp(20),
  },
});
