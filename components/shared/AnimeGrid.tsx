import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import AnimeCard from './AnimeCard';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type AnimeGridProps = {
  data: Anime[];
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  contentPaddingBottom?: number;
};

const NUM_COLUMNS = 3;

export default function AnimeGrid({
  data,
  onEndReached,
  isFetchingNextPage = false,
  contentPaddingBottom,
}: AnimeGridProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: Anime; index: number }) => <AnimeCard item={item} index={index} />,
    []
  );

  const ListFooter = useCallback(
    () =>
      isFetchingNextPage ? (
        <View className="items-center py-5">
          <ActivityIndicator size="small" color="#a3e635" />
        </View>
      ) : null,
    [isFetchingNextPage]
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.slug}
      numColumns={NUM_COLUMNS}
      renderItem={renderItem}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={ListFooter}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
      ]}
      columnWrapperStyle={styles.row}
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: hp(10),
    paddingHorizontal: wp(1),
  },
  row: {
    justifyContent: 'flex-start',
  },
});
