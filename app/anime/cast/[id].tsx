import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { fetchAniListAnimeCastPage } from '~/services/AniListService';
import { CharacterVoiceActor } from '~/types';

const CastCard = ({ item, index }: { item: CharacterVoiceActor; index: number }) => {
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}>
      <View className="min-h-[192px] flex-row items-center rounded-[18px] border border-white/10 bg-[#111310] p-3">
        {/* Character column */}
        <ScalePressable
          className="flex-1 items-center"
          scaleTo={0.96}
          onPress={() =>
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.id, kind: 'character' },
            })
          }>
          <Text className="mb-[7px] text-[9px] tracking-[1px] text-lime-400/70">CHARACTER</Text>
          <Animated.Image
            source={{ uri: item.image }}
            style={styles.personImage}
            sharedTransitionTag={`cast-character-${item.id}`}
          />
          <Text
            className="mt-2 text-center font-salsa text-[13px] font-bold text-white"
            numberOfLines={2}>
            {item.name}
          </Text>
          <Text className="mt-[3px] text-[11px] text-lime-400" numberOfLines={1}>
            {item.role}
          </Text>
        </ScalePressable>

        {/* Connector */}
        <View className="mx-[6px] h-7 w-7 items-center justify-center rounded-full bg-lime-400/10">
          <ArrowRight2 size={17} color="#a3e635" />
        </View>

        {/* Voice actor column */}
        <ScalePressable
          className="flex-1 items-center"
          scaleTo={0.96}
          disabled={!item.voiceActor}
          onPress={() =>
            item.voiceActor &&
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.voiceActor.id, kind: 'staff' },
            })
          }>
          <Text className="mb-[7px] text-[9px] tracking-[1px] text-lime-400/70">VOICE ACTOR</Text>
          {item.voiceActor?.image ? (
            <Animated.Image
              source={{ uri: item.voiceActor.image }}
              style={styles.personImage}
              sharedTransitionTag={`cast-staff-${item.voiceActor.id}`}
            />
          ) : (
            <View style={[styles.personImage, styles.imagePlaceholder]} />
          )}
          <Text
            className="mt-2 text-center font-salsa text-[13px] font-bold text-white"
            numberOfLines={2}>
            {item.voiceActor?.name || 'Voice actor unavailable'}
          </Text>
          <Text className="mt-[3px] text-[11px] text-lime-400" numberOfLines={1}>
            {item.voiceActor?.language || 'Voice Actor'}
          </Text>
        </ScalePressable>
      </View>
    </Animated.View>
  );
};

export default function CastScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['anilist', 'anime-cast', id],
      queryFn: ({ pageParam }) => fetchAniListAnimeCastPage(id, pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.currentPage + 1 : undefined),
      enabled: Boolean(id),
      staleTime: 15 * 60 * 1000,
    });

  const renderItem = useCallback(
    ({ item, index }: { item: CharacterVoiceActor; index: number }) => (
      <CastCard item={item} index={index} />
    ),
    []
  );

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return <ErrorScreen message="Unable to load the cast." onRetry={() => refetch()} />;
  }

  const cast = data?.pages.flatMap((page) => page.cast) ?? [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#0a0a0a]">
      {/* Header */}
      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <ScalePressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          scaleTo={0.86}
          accessibilityLabel="Go back">
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>
        <View className="mx-[10px] flex-1 items-center">
          <Text style={styles.title}>{getFormattedTitle('Cast')}</Text>
          <Text className="mt-[2px] text-xs text-white/45">
            {cast.length} character connections
          </Text>
        </View>
        <View className="w-10" />
      </View>

      {cast.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-base text-white/55">
            No cast information is available yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={cast}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color="#a3e635" style={styles.footerLoader} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  personImage: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#1b1e18' },
  imagePlaceholder: { borderWidth: 1, borderColor: 'rgba(163,230,53,0.18)' },
  listContent: { padding: 14, paddingBottom: 110, gap: 14 },
  footerLoader: { paddingVertical: 18 },
  title: { color: '#fff', fontFamily: 'Salsa-Regular', fontSize: 25, fontWeight: '700' },
});
