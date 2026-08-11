import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, Image, Text, TextInput, View } from 'react-native';

import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type Episode = {
  id: string;
  number: string;
  title: string;
  image?: string;
};

type EpisodeListProps = {
  episodes: Episode[];
  currentEpisodeId: string;
  fallbackImage?: string;
  onSelectEpisode: (episode: Episode) => void;
  ListHeaderComponent?: ReactElement | null;
};

// row height used for getItemLayout so scrollToIndex works even on a list
// that hasn't rendered that far yet (matters once you're at One Piece scale)
const ROW_HEIGHT = 84;

const EpisodeList = ({
  episodes,
  currentEpisodeId,
  onSelectEpisode,
  ListHeaderComponent,
}: EpisodeListProps) => {
  const listRef = useRef<FlatList<Episode>>(null);
  const [jumpValue, setJumpValue] = useState('');

  const handleJump = () => {
    const target = Number(jumpValue);
    if (!target) return;
    const index = episodes.findIndex((ep) => Number(ep.number) === target);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  };

  return (
    <FlatList
      ref={listRef}
      data={episodes}
      keyExtractor={(item) => item.id}
      style={{ flex: 1 }}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      onScrollToIndexFailed={({ index }) => {
        setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 300);
      }}
      contentContainerStyle={{ paddingBottom: 40 }}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <>
          {ListHeaderComponent}

          <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800' }}>
              Episodes{' '}
              <Text style={{ color: COLORS.textMuted, fontWeight: '600' }}>
                ({episodes.length})
              </Text>
            </Text>

            {episodes.length > 30 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.stroke ?? 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 12,
                }}>
                <TextInput
                  value={jumpValue}
                  onChangeText={setJumpValue}
                  onSubmitEditing={handleJump}
                  placeholder="Jump to episode…"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="go"
                  style={{ flex: 1, color: COLORS.text, height: 42 }}
                />
                <ScalePressable onPress={handleJump} scaleTo={0.96}>
                  <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 12 }}>Go</Text>
                </ScalePressable>
              </View>
            )}
          </View>
        </>
      }
      renderItem={({ item }) => {
        const isCurrent = item.id === currentEpisodeId;

        return (
          <ScalePressable
            onPress={() => onSelectEpisode(item)}
            scaleTo={0.99}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginHorizontal: 20,
              marginBottom: 10,
              height: ROW_HEIGHT - 10,
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isCurrent ? COLORS.accent : (COLORS.stroke ?? 'rgba(255,255,255,0.08)'),
              padding: 10,
            }}>
            <View
              style={{
                width: 88,
                height: 64,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: COLORS.bg,
              }}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />
              ) : null}
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  backgroundColor: 'rgba(7,8,6,0.75)',
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 6,
                }}>
                <Text style={{ color: COLORS.accent, fontSize: 10, fontWeight: '800' }}>
                  EP {item.number}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={{ color: COLORS.text, fontSize: 13.5, fontWeight: '600' }}>
                {item.title}
              </Text>
              {isCurrent && (
                <Text
                  style={{ color: COLORS.accent, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                  Now playing
                </Text>
              )}
            </View>
          </ScalePressable>
        );
      }}
    />
  );
};

export default EpisodeList;
