import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CastWorkCard from '~/components/details/CastWorkCard';
import LoadingScreen from '~/components/shared/LoadingScreen';
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

  if (isLoading) return <LoadingScreen />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-neutral-950">
      {/* Header */}
      <View className="flex-row items-center p-4" style={styles.headerBorder}>
        <ScalePressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          scaleTo={0.86}>
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>
        <Text className="flex-1 text-center" style={styles.title}>
          Famous Works
        </Text>
        <View className="w-10" />
      </View>

      <FlatList
        data={data?.works ?? []}
        keyExtractor={(work) => work.id}
        numColumns={3}
        renderItem={({ item }) => <CastWorkCard work={item} compact={false} />}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.subtitle}>{data?.name || 'Cast member'}</Text>}
        ListEmptyComponent={<Text className="mt-8 text-center text-white/50">No works found.</Text>}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: { color: '#fff', fontFamily: 'Salsa-Regular', fontSize: 22 },
  content: { padding: 14, paddingBottom: 110 },
  subtitle: { color: '#a3e635', fontSize: 15, marginBottom: 14 },
  row: { gap: 10 },
});
