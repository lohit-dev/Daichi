import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import LottieView from 'lottie-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import RowItem from '~/components/home/RowItem';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { fetchAniListCastPerson } from '~/services/AniListService';
import { Anime, CastPersonKind } from '~/types';

export default function CastPersonScreen() {
  const router = useRouter();
  const { personId, kind: kindParam } = useLocalSearchParams<{
    personId: string;
    kind: CastPersonKind;
  }>();
  const kind: CastPersonKind = kindParam === 'staff' ? 'staff' : 'character';
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['anilist', 'cast-person', kind, personId],
    queryFn: () => fetchAniListCastPerson(kind, personId),
    enabled: Boolean(personId),
    staleTime: 30 * 60 * 1000,
  });

  const facts = useMemo(() => {
    if (!data) return [];
    return [
      data.gender ? ['Gender', data.gender] : null,
      data.dateOfBirth ? ['Born', data.dateOfBirth] : null,
      data.age ? ['Age', `${data.age} years`] : null,
      data.language ? ['Language', data.language] : null,
      data.homeTown ? ['Hometown', data.homeTown] : null,
      data.yearsActive ? ['Active', data.yearsActive] : null,
      data.bloodType ? ['Blood type', data.bloodType] : null,
    ].filter(Boolean) as [string, string][];
  }, [data]);

  const works = useMemo<Anime[]>(
    () =>
      (data?.works ?? []).map((work) => ({
        title: work.title,
        slug: work.id,
        image: work.image,
        type: work.format || 'Anime',
      })),
    [data?.works]
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a3e635" />
        <Text style={styles.mutedText}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !data) {
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
        <Text style={styles.errorText}>Unable to load this profile.</Text>
        <ScalePressable onPress={() => refetch()} style={styles.retryButton} haptic="medium">
          <Text style={styles.retryText}>Try again</Text>
        </ScalePressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <ScalePressable onPress={() => router.back()} style={styles.backButton} scaleTo={0.86}>
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>
        <Text style={styles.headerTitle}>{getFormattedTitle('Profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Animated.Image
            source={{ uri: data.image }}
            style={styles.avatar}
            sharedTransitionTag={`cast-${kind}-${data.id}`}
          />
          <Text style={styles.name}>{getFormattedTitle(data.name)}</Text>
          <Text style={styles.kindLabel}>{kind === 'staff' ? 'Voice Actor' : 'Character'}</Text>
          {data.nativeName && data.nativeName !== data.name ? (
            <Text style={styles.nativeName}>{data.nativeName}</Text>
          ) : null}
        </View>

        {facts.length > 0 ? (
          <View style={styles.factsRow}>
            {facts.slice(0, 4).map((fact) => (
              <View style={styles.fact} key={fact[0]}>
                <Text style={styles.factLabel}>{fact[0]}</Text>
                <Text style={styles.factText} numberOfLines={2}>
                  {fact[1]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.alternateNames.length > 0 || data.spoilerNames.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{getFormattedTitle('Also known as')}</Text>
            {data.alternateNames.length > 0 ? (
              <Text style={styles.bio}>{data.alternateNames.join(' · ')}</Text>
            ) : null}
            {data.spoilerNames.length > 0 ? (
              <Text style={styles.spoilerText}>Spoiler names: {data.spoilerNames.join(' · ')}</Text>
            ) : null}
          </View>
        ) : null}

        {data.description ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{getFormattedTitle('Biography')}</Text>
            <Text style={styles.bio}>{data.description}</Text>
          </View>
        ) : null}

        {data.occupations?.length || data.nonAnimeRoles?.length ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{getFormattedTitle('Credits')}</Text>
            {data.occupations?.length ? (
              <Text style={styles.bio}>{data.occupations.join(' · ')}</Text>
            ) : null}
            {data.nonAnimeRoles?.length ? (
              <Text style={styles.bio}>{data.nonAnimeRoles.join(' · ')}</Text>
            ) : null}
          </View>
        ) : null}

        {data.favourites ? (
          <Text style={styles.favourite}>♥ {data.favourites.toLocaleString()} favourites</Text>
        ) : null}
        {data.siteUrl ? (
          <ScalePressable onPress={() => Linking.openURL(data.siteUrl!)} style={styles.siteButton}>
            <Text style={styles.siteButtonText}>Open AniList profile</Text>
          </ScalePressable>
        ) : null}

        {works.length > 0 ? (
          <RowItem
            className="-mx-4 mt-2"
            data={works}
            staticData={works}
            name="Famous Works"
            seeAll
          />
        ) : null}
      </ScrollView>
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
  headerTitle: { flex: 1, color: '#fff', fontFamily: 'Salsa', textAlign: 'center', fontSize: 22 },
  headerSpacer: { width: 40 },
  content: { padding: 16, paddingBottom: 110 },
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 20 },
  avatar: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#1b1e18',
    borderWidth: 3,
    borderColor: 'rgba(163,230,53,0.35)',
  },
  name: {
    color: '#fff',
    fontFamily: 'Salsa',
    fontSize: 29,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
  kindLabel: { color: '#a3e635', fontFamily: 'Salsa', fontSize: 14, marginTop: 4 },
  nativeName: { color: 'rgba(255,255,255,0.45)', fontFamily: 'Salsa', fontSize: 12, marginTop: 4 },
  factsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#30352d',
  },
  fact: {
    flexGrow: 1,
    minWidth: '44%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  factText: { color: '#f5f7ef', fontFamily: 'Salsa', fontSize: 11, textAlign: 'center' },
  sectionCard: { backgroundColor: '#30352d', borderRadius: 14, padding: 13, marginTop: 14 },
  sectionTitle: { color: '#fff', fontFamily: 'Salsa', fontSize: 19, fontWeight: '700' },
  bio: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Salsa',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  factLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Salsa',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  spoilerText: { color: '#f8b4c0', fontFamily: 'Salsa', fontSize: 11, marginTop: 7 },
  favourite: { color: '#fb7185', fontFamily: 'Salsa', fontSize: 13, marginTop: 15 },
  siteButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(163,230,53,0.14)',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 14,
  },
  siteButtonText: { color: '#bef264', fontFamily: 'Salsa', fontSize: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  mutedText: { color: 'rgba(255,255,255,0.55)', fontFamily: 'Salsa', marginTop: 12 },
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
  errorText: { color: '#fff', fontFamily: 'Salsa', fontSize: 17, marginTop: 8 },
  retryButton: {
    backgroundColor: '#bef264',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 18,
  },
  retryText: { color: '#182008', fontFamily: 'Salsa', fontWeight: '700' },
});
