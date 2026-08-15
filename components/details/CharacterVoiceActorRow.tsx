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
  rounded?: boolean;
};

type RoundedRowItemProps = {
  item: CharacterVoiceActor;
};

const RoundedRowItem = ({ item }: RoundedRowItemProps) => {
  const router = useRouter();

  // item.image is the character image — skip if missing
  if (!item?.image) {
    return null;
  }

  return (
    <View className="flex items-center justify-center">
      {/* Character */}
      <Animated.View
        entering={FadeInRight.duration(500)}
        className="flex items-center justify-center pr-2 pt-2">
        <ScalePressable
          scaleTo={0.92}
          onPress={() =>
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.id, kind: 'character' },
            })
          }>
          <View className="overflow-hidden rounded-full">
            <AnimatedImageBackground
              source={{ uri: item.image }}
              className="flex items-center justify-center"
              style={styles.roundedImage}
              sharedTransitionTag={`cast-character-${item.id}`}
            />
          </View>
          <Text className="font-salsa p-1 text-base text-white" numberOfLines={2}>
            {getFormattedTitle(item.name)}
          </Text>
          <Text className="font-salsa p-1 text-base text-lime-400" numberOfLines={1}>
            {item.role}
          </Text>
        </ScalePressable>
      </Animated.View>

      {/* Connector */}
      {item.voiceActor ? <ArrowSwapVertical size="28" color="#a3e635" /> : null}

      {/* Voice Actor */}
      {item.voiceActor ? (
        <Animated.View
          entering={FadeInRight.duration(500)}
          className="flex items-center justify-center pr-2 pt-2">
          <ScalePressable
            scaleTo={0.92}
            onPress={() =>
              router.push({
                pathname: '/anime/cast/person/[personId]',
                params: { personId: item.voiceActor?.id || '', kind: 'staff' },
              })
            }>
            <View className="overflow-hidden rounded-full">
              <AnimatedImageBackground
                source={{ uri: item.voiceActor.image }}
                className="flex items-center justify-center"
                style={styles.roundedImage}
                sharedTransitionTag={`cast-staff-${item.voiceActor.id}`}
              />
            </View>
            <Text className="font-salsa p-1 text-base text-white" numberOfLines={2}>
              {getFormattedTitle(item.voiceActor.name)}
            </Text>
            <Text className="font-salsa p-1 text-base text-lime-400" numberOfLines={1}>
              {item.voiceActor.language || 'Voice Actor'}
            </Text>
          </ScalePressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

export const CharacterVoiceActorRow = ({
  className,
  data = [],
  animeId,
  seeAll,
}: CharacterVoiceActorRowProps) => {
  const router = useRouter();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
    <View className={className}>
      <View className="flex flex-row items-center justify-between pb-2 pt-8">
        <Text className="font-salsa text-3xl font-semibold text-white">
          {getFormattedTitle('Characters & Voice Actors')}
        </Text>
        {seeAll && (
          <ScalePressable
            onPress={() => {
              if (animeId) {
                router.push({ pathname: '/anime/cast/[id]', params: { id: animeId } });
              }
            }}
            haptic="none">
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
        renderItem={({ item }) => <RoundedRowItem item={item} />}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
      />
    </View>
  );
};

export default CharacterVoiceActorRow;

const styles = StyleSheet.create({
  roundedImage: {
    width: wp(20),
    height: wp(20),
  },
});
