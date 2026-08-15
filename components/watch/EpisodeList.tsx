import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';

export type Episode = {
  id: string;
  number: string;
  title: string;
  image?: string;
  providerId?: string;
};

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisodeId?: string;
  onSelectEpisode: (episode: Episode) => void;
  onEndReached?: () => void;
  hasMoreImages?: boolean;
  fallbackImage?: string;
  ListHeaderComponent?: React.ReactElement | null;
}

export const EpisodeList = React.memo(
  ({
    episodes,
    currentEpisodeId,
    onSelectEpisode,
    onEndReached,
    hasMoreImages,
    ListHeaderComponent,
  }: EpisodeListProps) => {
    const renderItem = useCallback(
      ({ item }: { item: Episode }) => {
        const isActive = item.id === currentEpisodeId;
        return (
          <TouchableOpacity
            onPress={() => onSelectEpisode(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              backgroundColor: isActive ? '#E11D48' : 'transparent',
              borderRadius: 8,
              marginBottom: 4,
            }}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: 80, height: 45, borderRadius: 4, marginRight: 12 }}
              />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 45,
                  borderRadius: 4,
                  marginRight: 12,
                  backgroundColor: '#333',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Text style={{ color: '#666', fontSize: 12 }}>EP {item.number}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: isActive ? '#fff' : '#ccc',
                  fontSize: 14,
                  fontWeight: '600',
                }}
                numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          </TouchableOpacity>
        );
      },
      [currentEpisodeId, onSelectEpisode]
    );

    const keyExtractor = useCallback((item: Episode) => item.id, []);

    return (
      <FlatList
        data={episodes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={hasMoreImages ? onEndReached : undefined}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
      />
    );
  }
);
