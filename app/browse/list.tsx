import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeCard from '~/components/shared/AnimeCard';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { fetchAniListDubbed, fetchAniListSubbed } from '~/services/AniListService';
import { Anime } from '~/types';

const NUM_COLUMNS = 3;

export default function StaticListScreen() {
  const router = useRouter();
  const { title, data, source } = useLocalSearchParams<{
    title?: string;
    data?: string;
    source?: 'subbed' | 'dubbed';
  }>();

  const catalogueQuery = useQuery<Anime[]>({
    queryKey: ['anilist', source],
    queryFn: source === 'subbed' ? fetchAniListSubbed : fetchAniListDubbed,
    enabled: Boolean(source),
    staleTime: 10 * 60 * 1000,
  });

  const items: Anime[] = useMemo(() => {
    if (source) return catalogueQuery.data ?? [];
    if (!data) return [];
    try {
      return JSON.parse(decodeURIComponent(data as string)) as Anime[];
    } catch {
      return [];
    }
  }, [catalogueQuery.data, data, source]);

  const displayTitle = title ? decodeURIComponent(title as string) : 'Anime';

  const renderItem = useCallback(
    ({ item, index }: { item: Anime; index: number }) => <AnimeCard item={item} index={index} />,
    []
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <ScalePressable
          onPress={() => router.back()}
          style={styles.backBtn}
          scaleTo={0.85}
          accessibilityLabel="Go back">
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {getFormattedTitle(displayTitle)}
        </Text>

        {/* Spacer keeps title centred */}
        <View style={styles.headerSpacer} />
      </Animated.View>

      {catalogueQuery.isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      ) : catalogueQuery.isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Unable to load this catalogue.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No titles found.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.slug}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'Salsa',
    fontSize: 22,
    marginHorizontal: 8,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: hp(10),
    paddingHorizontal: wp(1),
  },
  row: {
    justifyContent: 'flex-start',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Salsa',
    fontSize: 16,
  },
});
