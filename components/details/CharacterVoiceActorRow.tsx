import { useRouter } from 'expo-router';
import { ArrowSwapVertical } from 'iconsax-react-native';
import React from 'react';
import { FlatList, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import ScalePressable from '../shared/ScalePressable';

import { getFormattedTitle } from '~/helpers/TextFormat';
import { wp } from '~/helpers/common';
import { CharacterVoiceActor } from '~/types';

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

type CharacterVoiceActorRowProps = {
  data: CharacterVoiceActor[];
  animeId?: string;
  className?: string;
  seeAll?: boolean;
};

type RoundedRowItemProps = { item: CharacterVoiceActor };

const RoundedRowItem = ({ item }: RoundedRowItemProps) => {
  const router = useRouter();

  if (!item?.image) return null;

  return (
    <Animated.View entering={FadeInRight.duration(400)} style={styles.columnContainer}>
      {/* Character */}
      <ScalePressable
        scaleTo={0.92}
        style={styles.itemBlock}
        onPress={() =>
          router.push({
            pathname: '/anime/cast/person/[personId]',
            params: { personId: item.id, kind: 'character' },
          })
        }>
        <View className="overflow-hidden rounded-full">
          <AnimatedImageBackground
            source={{ uri: item.image }}
            className="items-center justify-center"
            style={styles.roundedImage}
            sharedTransitionTag={`cast-character-${item.id}`}
          />
        </View>
        <Text
          className="pt-1 text-center font-salsa text-sm text-white"
          numberOfLines={2}
          ellipsizeMode="tail">
          {getFormattedTitle(item.name)}
        </Text>
        <Text className="text-center font-salsa text-xs text-lime-400" numberOfLines={1}>
          {item.role}
        </Text>
      </ScalePressable>

      {item.voiceActor ? (
        <View style={styles.swapIconContainer}>
          <ArrowSwapVertical size="20" color="#a3e635" />
        </View>
      ) : null}

      {/* Voice Actor */}
      {item.voiceActor ? (
        <ScalePressable
          scaleTo={0.92}
          style={styles.itemBlock}
          onPress={() =>
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.voiceActor?.id || '', kind: 'staff' },
            })
          }>
          <View className="overflow-hidden rounded-full">
            <AnimatedImageBackground
              source={{ uri: item.voiceActor.image }}
              className="items-center justify-center"
              style={styles.roundedImage}
              sharedTransitionTag={`cast-staff-${item.voiceActor.id}`}
            />
          </View>
          <Text
            className="pt-1 text-center font-salsa text-sm text-white"
            numberOfLines={2}
            ellipsizeMode="tail">
            {getFormattedTitle(item.voiceActor.name)}
          </Text>
          <Text className="text-center font-salsa text-xs text-lime-400" numberOfLines={1}>
            {item.voiceActor.language || 'Voice Actor'}
          </Text>
        </ScalePressable>
      ) : null}
    </Animated.View>
  );
};

export const CharacterVoiceActorRow = ({
  className,
  data = [],
  animeId,
  seeAll,
}: CharacterVoiceActorRowProps) => {
  const router = useRouter();

  if (!Array.isArray(data) || data.length === 0) return null;

  return (
    <View className={className}>
      <View className="flex-row items-center justify-between gap-2 pb-3 pt-3">
        <Text className="flex-1 font-salsa text-2xl font-semibold text-white" numberOfLines={1}>
          {getFormattedTitle('Characters & Voice Actors')}
        </Text>
        {seeAll && (
          <ScalePressable
            onPress={() => {
              if (animeId) router.push({ pathname: '/anime/cast/[id]', params: { id: animeId } });
            }}
            className="shrink-0 pl-2"
            haptic="none">
            <Text className="font-salsa text-sm font-semibold text-lime-300">View all</Text>
          </ScalePressable>
        )}
      </View>
      <FlatList
        nestedScrollEnabled
        scrollEventThrottle={16}
        horizontal
        data={data}
        contentContainerStyle={styles.listContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <RoundedRowItem item={item} />}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        maxToRenderPerBatch={12}
      />
    </View>
  );
};

export default CharacterVoiceActorRow;

const styles = StyleSheet.create({
  columnContainer: {
    width: wp(28),
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  itemBlock: {
    width: '100%',
    alignItems: 'center',
  },
  roundedImage: {
    width: wp(20),
    height: wp(20),
  },
  swapIconContainer: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 8,
  },
});
