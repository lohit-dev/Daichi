import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-react-native';
import LottieView from 'lottie-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { fetchAniListAnimeCastPage } from '~/services/AniListService';
import { CharacterVoiceActor } from '~/types';

const CastCard = ({ item, index }: { item: CharacterVoiceActor; index: number }) => {
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}>
      <View style={styles.castCard}>
        <ScalePressable
          style={styles.personColumn}
          scaleTo={0.96}
          onPress={() =>
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.id, kind: 'character' },
            })
          }>
          <Text style={styles.personType}>CHARACTER</Text>
          <Animated.Image
            source={{ uri: item.image }}
            style={styles.personImage}
            sharedTransitionTag={`cast-character-${item.id}`}
          />
          <Text style={styles.personName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.personRole} numberOfLines={1}>
            {item.role}
          </Text>
        </ScalePressable>

        <View style={styles.connector}>
          <ArrowRight2 size={17} color="#a3e635" />
        </View>

        <ScalePressable
          style={styles.personColumn}
          scaleTo={0.96}
          disabled={!item.voiceActor}
          onPress={() =>
            item.voiceActor &&
            router.push({
              pathname: '/anime/cast/person/[personId]',
              params: { personId: item.voiceActor.id, kind: 'staff' },
            })
          }>
          <Text style={styles.personType}>VOICE ACTOR</Text>
          {item.voiceActor?.image ? (
            <Animated.Image
              source={{ uri: item.voiceActor.image }}
              style={styles.personImage}
              sharedTransitionTag={`cast-staff-${item.voiceActor.id}`}
            />
          ) : (
            <View style={[styles.personImage, styles.imagePlaceholder]} />
          )}
          <Text style={styles.personName} numberOfLines={2}>
            {item.voiceActor?.name || 'Voice actor unavailable'}
          </Text>
          <Text style={styles.personRole} numberOfLines={1}>
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a3e635" />
        <Text style={styles.mutedText}>Loading cast…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <ScalePressable
          onPress={() => router.back()}
          style={styles.errorBackButton}
          scaleTo={0.86}
          accessibilityLabel="Go back">
          <ArrowLeft2 size={20} color="#fff" />
        </ScalePressable>
        <LottieView
          source={require('~/assets/lottie/Error.json')}
          autoPlay
          loop
          style={styles.errorAnimation}
        />
        <Text style={styles.errorText}>Unable to load the cast.</Text>
        <ScalePressable onPress={() => refetch()} style={styles.retryButton} haptic="medium">
          <Text style={styles.retryText}>Try again</Text>
        </ScalePressable>
      </View>
    );
  }

  const cast = data?.pages.flatMap((page) => page.cast) ?? [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <ScalePressable
          onPress={() => router.back()}
          style={styles.backButton}
          scaleTo={0.86}
          accessibilityLabel="Go back">
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{getFormattedTitle('Cast')}</Text>
          <Text style={styles.subtitle}>{cast.length} character connections</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {cast.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No cast information is available yet.</Text>
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
  screen: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerCopy: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  headerSpacer: { width: 40 },
  title: { color: '#fff', fontFamily: 'Salsa-Regular', fontSize: 25, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  listContent: { padding: 14, paddingBottom: 110, gap: 14 },
  footerLoader: { paddingVertical: 18 },
  castCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111310',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    minHeight: 192,
  },
  personColumn: { flex: 1, alignItems: 'center' },
  personType: {
    color: 'rgba(163,230,53,0.7)',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 7,
  },
  personImage: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#1b1e18' },
  imagePlaceholder: { borderWidth: 1, borderColor: 'rgba(163,230,53,0.18)' },
  personName: {
    color: '#fff',
    fontFamily: 'Salsa-Regular',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  personRole: { color: '#a3e635', fontSize: 11, marginTop: 3 },
  connector: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(163,230,53,0.12)',
    marginHorizontal: 6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  mutedText: { color: 'rgba(255,255,255,0.55)', marginTop: 12 },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    textAlign: 'center',
  },
  errorAnimation: { width: 180, height: 180 },
  errorBackButton: {
    position: 'absolute',
    top: 18,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  errorText: { color: '#fff', fontSize: 17, marginTop: 8 },
  retryButton: {
    backgroundColor: '#bef264',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 18,
  },
  retryText: { color: '#182008', fontWeight: '700' },
});
