import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Image, StyleSheet, Text, View } from 'react-native';

import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { AniListDiscussionThread, fetchAniListEpisodeDiscussion } from '~/services/AniListService';

type EpisodeDiscussionProps = {
  animeId: string;
  episodeId: string;
  episodeTitle?: string;
};

const ThreadPreview = ({ thread }: { thread: AniListDiscussionThread }) => (
  <ScalePressable
    onPress={() => Linking.openURL(`https://anilist.co/forum/thread/${thread.id}`)}
    style={styles.thread}
    scaleTo={0.985}>
    {thread.user.avatar ? (
      <Image source={{ uri: thread.user.avatar }} style={styles.avatar} />
    ) : (
      <View style={styles.avatar} />
    )}
    <View style={styles.threadCopy}>
      <Text numberOfLines={1} style={styles.threadTitle}>
        {thread.title}
      </Text>
      <Text numberOfLines={2} style={styles.threadBody}>
        {thread.body || 'Open this discussion on AniList.'}
      </Text>
      <View style={styles.threadMeta}>
        <Text style={styles.user}>{thread.user.name}</Text>
        <Ionicons name="chatbubble-outline" size={12} color={COLORS.textFaint} />
        <Text style={styles.replyCount}>{thread.replyCount}</Text>
      </View>
    </View>
    <Ionicons name="open-outline" size={15} color={COLORS.textFaint} />
  </ScalePressable>
);

const EpisodeDiscussion = ({ animeId, episodeId, episodeTitle }: EpisodeDiscussionProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['anilist', 'episode-discussion', animeId, episodeId],
    queryFn: () => fetchAniListEpisodeDiscussion(animeId, episodeId, episodeTitle),
    enabled: Boolean(animeId && episodeId),
    staleTime: 10 * 60 * 1000,
  });

  const threads = data?.episodeThreads.length
    ? data.episodeThreads
    : (data?.communityThreads ?? []);
  const hasEpisodeThread = Boolean(data?.episodeThreads.length);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>COMMUNITY CHAT</Text>
          <Text style={styles.heading}>Talk about it</Text>
        </View>
        <ScalePressable
          onPress={() => Linking.openURL(`https://anilist.co/anime/${animeId}`)}
          style={styles.anilistButton}
          scaleTo={0.94}>
          <Text style={styles.anilistButtonText}>AniList</Text>
          <Ionicons name="open-outline" size={13} color={COLORS.bg} />
        </ScalePressable>
      </View>

      {isLoading ? <Text style={styles.loading}>Loading conversations…</Text> : null}
      {!isLoading && !hasEpisodeThread ? (
        <Text style={styles.note}>
          Episode-specific threads are not available from AniList yet, so these are recent
          conversations for the anime.
        </Text>
      ) : null}
      {threads.map((thread) => (
        <ThreadPreview key={thread.id} thread={thread} />
      ))}
      {!isLoading && threads.length === 0 ? (
        <Text style={styles.loading}>No AniList conversations are available yet.</Text>
      ) : null}
    </View>
  );
};

export default EpisodeDiscussion;

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 12 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: 3,
  },
  heading: { color: COLORS.text, fontFamily: 'Salsa-Regular', fontSize: 25 },
  anilistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 99,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  anilistButtonText: { color: COLORS.bg, fontSize: 10, fontWeight: '900' },
  note: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 11 },
  loading: { color: COLORS.textMuted, fontSize: 12, paddingVertical: 12 },
  thread: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
  },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#20261f' },
  threadCopy: { flex: 1, minWidth: 0 },
  threadTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  threadBody: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  threadMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  user: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  replyCount: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
});
