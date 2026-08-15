import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import LottieView from 'lottie-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import RowItem from '~/components/home/RowItem';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { fetchAniListCastPerson } from '~/services/AniListService';
import { Anime, CastPersonKind } from '~/types';

type ProfileFact = { label: string; value: string };

const FactGrid = ({ facts }: { facts: ProfileFact[] }) => (
  <View style={styles.factGrid}>
    {facts.map((fact) => (
      <View key={fact.label} style={styles.factCard}>
        <Text style={styles.factLabel}>{fact.label}</Text>
        <Text style={styles.factValue} numberOfLines={2}>
          {fact.value}
        </Text>
      </View>
    ))}
  </View>
);

const SectionHeading = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
    <Text style={styles.sectionTitle}>{getFormattedTitle(title)}</Text>
  </View>
);

export default function CastPersonScreen() {
  const router = useRouter();
  const { personId, kind: kindParam } = useLocalSearchParams<{
    personId: string;
    kind: CastPersonKind;
  }>();
  const kind: CastPersonKind = kindParam === 'staff' ? 'staff' : 'character';
  const isStaff = kind === 'staff';
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['anilist', 'cast-person', kind, personId],
    queryFn: () => fetchAniListCastPerson(kind, personId),
    enabled: Boolean(personId),
    staleTime: 30 * 60 * 1000,
  });

  const facts = useMemo<ProfileFact[]>(() => {
    if (!data) return [];

    return (
      isStaff
        ? [
            data.language ? { label: 'Language', value: data.language } : null,
            data.yearsActive ? { label: 'Active', value: data.yearsActive } : null,
            data.homeTown ? { label: 'Based in', value: data.homeTown } : null,
            data.agency ? { label: 'Agency', value: data.agency } : null,
            data.dateOfBirth ? { label: 'Born', value: data.dateOfBirth } : null,
            data.bloodType ? { label: 'Blood type', value: data.bloodType } : null,
          ]
        : [
            data.gender ? { label: 'Gender', value: data.gender } : null,
            data.age ? { label: 'Age', value: `${data.age} years` } : null,
            data.dateOfBirth ? { label: 'Birthday', value: data.dateOfBirth } : null,
            data.bloodType ? { label: 'Blood type', value: data.bloodType } : null,
          ]
    ).filter((fact): fact is ProfileFact => Boolean(fact));
  }, [data, isStaff]);

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
        <ActivityIndicator size="large" color="#bef264" />
        <Text style={styles.mutedText}>Preparing profile…</Text>
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
        <Text style={styles.errorText}>This profile could not be loaded.</Text>
        <ScalePressable onPress={() => refetch()} style={styles.retryButton} haptic="medium">
          <Text style={styles.retryText}>Try again</Text>
        </ScalePressable>
      </View>
    );
  }

  const aliases = data.alternateNames.filter((name) => name !== data.name);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.topBar}>
        <ScalePressable onPress={() => router.back()} style={styles.backButton} scaleTo={0.86}>
          <ArrowLeft2 size={21} color="#fff" />
        </ScalePressable>
        <Text style={styles.topBarTitle}>{isStaff ? 'Voice actor' : 'Character'}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isStaff ? (
          <Animated.View entering={FadeInDown.duration(360)} style={styles.staffPass}>
            <LinearGradient
              colors={['#26351d', '#12170f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.Image
              source={{ uri: data.image }}
              style={styles.staffPortrait}
              sharedTransitionTag={`cast-${kind}-${data.id}`}
            />
            <View style={styles.staffCopy}>
              <Text style={styles.eyebrow}>VOICE ACTOR</Text>
              <Text style={styles.staffName} numberOfLines={2}>
                {getFormattedTitle(data.name)}
              </Text>
              {data.nativeName && data.nativeName !== data.name ? (
                <Text style={styles.nativeName}>{data.nativeName}</Text>
              ) : null}
              <View style={styles.staffBadge}>
                <Text style={styles.staffBadgeText}>
                  {data.language || 'Japanese voice talent'}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(360)} style={styles.characterHero}>
            <LinearGradient
              colors={['#27331e', '#11150e']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.characterPanel}
            />
            <View style={styles.characterImageFrame}>
              <Animated.Image
                source={{ uri: data.image }}
                style={styles.characterPortrait}
                sharedTransitionTag={`cast-${kind}-${data.id}`}
              />
            </View>
            <Text style={styles.eyebrow}>CHARACTER FILE</Text>
            <Text style={styles.characterName}>{getFormattedTitle(data.name)}</Text>
            {data.nativeName && data.nativeName !== data.name ? (
              <Text style={styles.nativeName}>{data.nativeName}</Text>
            ) : null}
            {data.role ? <Text style={styles.characterRole}>{data.role}</Text> : null}
          </Animated.View>
        )}

        {facts.length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(80).duration(360)}
            style={styles.identitySection}>
            <SectionHeading eyebrow={isStaff ? 'STUDIO NOTES' : 'IDENTITY'} title="At a glance" />
            <FactGrid facts={facts} />
          </Animated.View>
        ) : null}

        {aliases.length > 0 || data.spoilerNames.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(120).duration(360)} style={styles.aliasCard}>
            <Text style={styles.aliasMark}>AKA</Text>
            <View style={styles.aliasCopy}>
              <Text style={styles.aliasTitle}>Other names</Text>
              {aliases.length > 0 ? (
                <Text style={styles.aliasText}>{aliases.join(' · ')}</Text>
              ) : null}
              {data.spoilerNames.length > 0 ? (
                <Text style={styles.spoilerText}>
                  Spoiler alias · {data.spoilerNames.join(' · ')}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {data.description ? (
          <Animated.View entering={FadeInDown.delay(150).duration(360)} style={styles.storyCard}>
            <SectionHeading
              eyebrow={isStaff ? 'CAREER NOTES' : 'CHARACTER NOTES'}
              title="Biography"
            />
            <Text style={styles.description}>{data.description}</Text>
          </Animated.View>
        ) : null}

        {data.occupations?.length || data.nonAnimeRoles?.length ? (
          <Animated.View entering={FadeInDown.delay(180).duration(360)} style={styles.creditCard}>
            <SectionHeading eyebrow="BEYOND ANIME" title="Credits" />
            {data.occupations?.length ? (
              <Text style={styles.creditText}>{data.occupations.join(' · ')}</Text>
            ) : null}
            {data.nonAnimeRoles?.length ? (
              <Text style={styles.creditText}>{data.nonAnimeRoles.join(' · ')}</Text>
            ) : null}
          </Animated.View>
        ) : null}

        {(data.favourites || data.siteUrl) && (
          <View style={styles.profileActions}>
            {data.favourites ? (
              <View style={styles.favouritePill}>
                <Text style={styles.favouriteText}>
                  ♥ {data.favourites.toLocaleString()} favourites
                </Text>
              </View>
            ) : null}
            {data.siteUrl ? (
              <ScalePressable
                onPress={() => Linking.openURL(data.siteUrl!)}
                style={styles.siteButton}>
                <Text style={styles.siteButtonText}>Open AniList profile</Text>
              </ScalePressable>
            ) : null}
          </View>
        )}

        {works.length > 0 ? (
          <RowItem
            className="-mx-4 mt-3"
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
  screen: { flex: 1, backgroundColor: '#090b09' },
  topBar: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  topBarTitle: { flex: 1, color: '#c9d1c0', textAlign: 'center', fontSize: 13, fontWeight: '700' },
  topBarSpacer: { width: 40 },
  content: { padding: 16, paddingBottom: 112 },
  eyebrow: { color: '#d9ff9f', fontSize: 10, fontWeight: '800', letterSpacing: 1.55 },
  nativeName: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 4 },
  characterHero: { alignItems: 'center', paddingBottom: 22, overflow: 'hidden', borderRadius: 24 },
  characterPanel: { ...StyleSheet.absoluteFill },
  characterImageFrame: {
    width: 166,
    height: 166,
    marginTop: 24,
    marginBottom: 17,
    padding: 4,
    borderRadius: 83,
    borderWidth: 1,
    borderColor: '#d9ff9f',
    backgroundColor: '#10150d',
  },
  characterPortrait: {
    width: '100%',
    height: '100%',
    borderRadius: 79,
    backgroundColor: '#192016',
  },
  characterName: {
    color: '#fff',
    fontFamily: 'Salsa-Regular',
    fontSize: 31,
    lineHeight: 37,
    textAlign: 'center',
    marginTop: 7,
    paddingHorizontal: 18,
  },
  characterRole: { color: '#d9ff9f', fontSize: 13, fontWeight: '700', marginTop: 10 },
  staffPass: {
    minHeight: 192,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 16,
  },
  staffPortrait: {
    width: 130,
    height: 160,
    borderRadius: 18,
    backgroundColor: '#192016',
    borderWidth: 1,
    borderColor: 'rgba(217,255,159,0.62)',
  },
  staffCopy: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 16 },
  staffName: {
    color: '#fff',
    fontFamily: 'Salsa-Regular',
    fontSize: 27,
    lineHeight: 33,
    marginTop: 7,
  },
  staffBadge: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    backgroundColor: 'rgba(217,255,159,0.15)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 14,
  },
  staffBadgeText: { color: '#e4ffc1', fontSize: 10, fontWeight: '700' },
  identitySection: { marginTop: 22 },
  sectionHeading: { marginBottom: 10 },
  sectionEyebrow: { color: '#9fb18e', fontSize: 9, fontWeight: '800', letterSpacing: 1.25 },
  sectionTitle: { color: '#fff', fontFamily: 'Salsa-Regular', fontSize: 23, marginTop: 3 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  factCard: {
    width: '48.8%',
    minHeight: 70,
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#151914',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,255,159,0.15)',
    padding: 10,
  },
  factLabel: {
    color: '#8c9884',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  factValue: { color: '#eff5ea', fontSize: 13, fontWeight: '600', marginTop: 6 },
  aliasCard: {
    flexDirection: 'row',
    gap: 13,
    marginTop: 18,
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#d9ff9f',
    backgroundColor: '#151914',
    padding: 13,
  },
  aliasMark: { color: '#d9ff9f', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  aliasCopy: { flex: 1 },
  aliasTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  aliasText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, marginTop: 5 },
  spoilerText: { color: '#f9a8b9', fontSize: 12, lineHeight: 18, marginTop: 7 },
  storyCard: {
    marginTop: 21,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.11)',
    paddingTop: 20,
  },
  description: { color: 'rgba(245,249,241,0.8)', fontSize: 14, lineHeight: 22, marginTop: 10 },
  creditCard: { marginTop: 21, borderRadius: 16, backgroundColor: '#151914', padding: 14 },
  creditText: { color: 'rgba(245,249,241,0.75)', fontSize: 13, lineHeight: 20, marginTop: 8 },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
  },
  favouritePill: {
    borderRadius: 99,
    backgroundColor: 'rgba(253,164,175,0.12)',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  favouriteText: { color: '#fbb6c2', fontSize: 11, fontWeight: '700' },
  siteButton: {
    borderRadius: 99,
    backgroundColor: '#d9ff9f',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  siteButtonText: { color: '#182008', fontSize: 11, fontWeight: '800' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090b09',
    padding: 24,
  },
  mutedText: { color: 'rgba(255,255,255,0.55)', marginTop: 12 },
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
    backgroundColor: '#d9ff9f',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 18,
  },
  retryText: { color: '#182008', fontWeight: '700' },
});
