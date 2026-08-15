import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CastWorkCard from '~/components/details/CastWorkCard';
import ScalePressable from '~/components/shared/ScalePressable';
import { fetchAniListCastPerson } from '~/services/AniListService';
import { CastPersonKind } from '~/types';

export default function CastWorksScreen() {
  const router = useRouter();
  const { personId, kind: kindParam } = useLocalSearchParams<{
    personId: string;
    kind: CastPersonKind;
  }>();
  const kind: CastPersonKind = kindParam === 'staff' ? 'staff' : 'character';
  const { data, isLoading } = useQuery({
    queryKey: ['anilist', 'cast-person', kind, personId],
    queryFn: () => fetchAniListCastPerson(kind, personId),
    enabled: Boolean(personId),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <ScalePressable onPress={() => router.back()} style={styles.backButton} scaleTo={0.86}>
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>
        <Text style={styles.title}>Famous Works</Text>
        <View style={styles.spacer} />
      </View>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      ) : (
        <FlatList
          data={data?.works ?? []}
          keyExtractor={(work) => work.id}
          numColumns={3}
          renderItem={({ item }) => <CastWorkCard work={item} compact={false} />}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<Text style={styles.subtitle}>{data?.name || 'Cast member'}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No works found.</Text>}
          showsVerticalScrollIndicator={false}
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
    padding: 16,
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
  title: { flex: 1, color: '#fff', fontFamily: 'Salsa-Regular', fontSize: 22, textAlign: 'center' },
  spacer: { width: 40 },
  content: { padding: 14, paddingBottom: 110 },
  subtitle: { color: '#a3e635', fontSize: 15, marginBottom: 14 },
  row: { gap: 10, marginBottom: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  empty: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 30,
  },
});
