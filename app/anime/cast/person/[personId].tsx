import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import RowItem from '~/components/home/RowItem';
import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { fetchAniListCastPerson } from '~/services/AniListService';
import { Anime, CastPersonKind } from '~/types';

type ProfileFact = { label: string; value: string };

const FactGrid = ({ facts }: { facts: ProfileFact[] }) => (
  <View className="flex-row flex-wrap gap-2">
    {facts.map((fact) => (
      <View
        key={fact.label}
        className="min-h-[70px] w-[48.8%] justify-between rounded-2xl border border-[rgba(217,255,159,0.15)] bg-[#151914] p-2.5">
        <Text className="text-[9px] font-extrabold uppercase tracking-[0.8px] text-[#8c9884]">
          {fact.label}
        </Text>
        <Text className="mt-1.5 text-[13px] font-semibold text-[#eff5ea]" numberOfLines={2}>
          {fact.value}
        </Text>
      </View>
    ))}
  </View>
);

const SectionHeading = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <View className="mb-2.5">
    <Text className="text-[9px] font-extrabold tracking-[1.25px] text-[#9fb18e]">{eyebrow}</Text>
    <Text className="mt-0.5 font-salsa text-[23px] text-white">{getFormattedTitle(title)}</Text>
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
    ).filter((f): f is ProfileFact => Boolean(f));
  }, [data, isStaff]);

  const works = useMemo<Anime[]>(
    () =>
      (data?.works ?? []).map((w) => ({
        title: w.title,
        slug: w.id,
        image: w.image,
        type: w.format || 'Anime',
      })),
    [data?.works]
  );

  if (isLoading) return <LoadingScreen />;
  if (error || !data) {
    return <ErrorScreen message="This profile could not be loaded." onRetry={() => refetch()} />;
  }

  const aliases = data.alternateNames.filter((n) => n !== data.name);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#090b09]">
      {/* Top bar */}
      <View className="h-[62px] flex-row items-center border-b border-white/[0.08] px-4">
        <ScalePressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          scaleTo={0.86}>
          <ArrowLeft2 size={21} color="#fff" />
        </ScalePressable>
        <Text className="flex-1 text-center text-[13px] font-bold text-[#c9d1c0]">
          {isStaff ? 'Voice actor' : 'Character'}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 112 }}>
        {/* ── Staff hero ── */}
        {isStaff ? (
          <Animated.View
            entering={FadeInDown.duration(360)}
            className="min-h-[192px] flex-row items-center overflow-hidden rounded-3xl p-4">
            <LinearGradient
              colors={['#26351d', '#12170f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.Image
              source={{ uri: data.image }}
              className="rounded-[18px] border border-[rgba(217,255,159,0.62)] bg-[#192016]"
              style={styles.staffPortrait}
              sharedTransitionTag={`cast-${kind}-${data.id}`}
            />
            <View className="flex-1 justify-center pl-4">
              <Text className="text-[10px] font-extrabold tracking-[1.55px] text-[#d9ff9f]">
                VOICE ACTOR
              </Text>
              <Text
                className="mt-[7px] font-salsa text-[27px] leading-[33px] text-white"
                numberOfLines={2}>
                {getFormattedTitle(data.name)}
              </Text>
              {data.nativeName && data.nativeName !== data.name && (
                <Text className="mt-1 text-xs text-white/[0.58]">{data.nativeName}</Text>
              )}
              <View className="mt-[14px] self-start rounded-full bg-[rgba(217,255,159,0.15)] px-[9px] py-1.5">
                <Text className="text-[10px] font-bold text-[#e4ffc1]">
                  {data.language || 'Japanese voice talent'}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          /* ── Character hero ── */
          <Animated.View
            entering={FadeInDown.duration(360)}
            className="items-center overflow-hidden rounded-3xl pb-[22px]">
            <LinearGradient
              colors={['#27331e', '#11150e']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              className="mb-[17px] mt-6 rounded-full border border-[#d9ff9f] bg-[#10150d] p-1"
              style={styles.characterImageFrame}>
              <Animated.Image
                source={{ uri: data.image }}
                className="rounded-full bg-[#192016]"
                style={styles.characterPortrait}
                sharedTransitionTag={`cast-${kind}-${data.id}`}
              />
            </View>
            <Text className="text-[10px] font-extrabold tracking-[1.55px] text-[#d9ff9f]">
              CHARACTER FILE
            </Text>
            <Text className="mt-[7px] px-[18px] text-center font-salsa text-[31px] leading-[37px] text-white">
              {getFormattedTitle(data.name)}
            </Text>
            {data.nativeName && data.nativeName !== data.name && (
              <Text className="mt-1 text-xs text-white/[0.58]">{data.nativeName}</Text>
            )}
            {data.role && (
              <Text className="mt-[10px] text-[13px] font-bold text-[#d9ff9f]">{data.role}</Text>
            )}
          </Animated.View>
        )}

        {/* Facts */}
        {facts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(360)} className="mt-[22px]">
            <SectionHeading eyebrow={isStaff ? 'STUDIO NOTES' : 'IDENTITY'} title="At a glance" />
            <FactGrid facts={facts} />
          </Animated.View>
        )}

        {/* Aliases */}
        {(aliases.length > 0 || data.spoilerNames.length > 0) && (
          <Animated.View
            entering={FadeInDown.delay(120).duration(360)}
            className="mt-[18px] flex-row gap-[13px] rounded-2xl border-l-[3px] border-l-[#d9ff9f] bg-[#151914] p-[13px]">
            <Text className="text-[11px] font-black tracking-[1px] text-[#d9ff9f]">AKA</Text>
            <View className="flex-1">
              <Text className="text-[13px] font-extrabold text-white">Other names</Text>
              {aliases.length > 0 && (
                <Text className="mt-[5px] text-[13px] leading-[19px] text-white/[0.72]">
                  {aliases.join(' · ')}
                </Text>
              )}
              {data.spoilerNames.length > 0 && (
                <Text className="mt-[7px] text-xs leading-[18px] text-[#f9a8b9]">
                  Spoiler alias · {data.spoilerNames.join(' · ')}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Biography */}
        {data.description && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(360)}
            className="mt-[21px] border-t border-white/[0.11] pt-5">
            <SectionHeading
              eyebrow={isStaff ? 'CAREER NOTES' : 'CHARACTER NOTES'}
              title="Biography"
            />
            <Text className="mt-2.5 text-sm leading-[22px] text-white/80">{data.description}</Text>
          </Animated.View>
        )}

        {/* Credits */}
        {data.occupations?.length || data.nonAnimeRoles?.length ? (
          <Animated.View
            entering={FadeInDown.delay(180).duration(360)}
            className="mt-[21px] rounded-2xl bg-[#151914] p-3.5">
            <SectionHeading eyebrow="BEYOND ANIME" title="Credits" />
            {data.occupations?.length ? (
              <Text className="mt-2 text-[13px] leading-5 text-white/[0.75]">
                {data.occupations.join(' · ')}
              </Text>
            ) : null}
            {data.nonAnimeRoles?.length ? (
              <Text className="mt-2 text-[13px] leading-5 text-white/[0.75]">
                {data.nonAnimeRoles.join(' · ')}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Favourites + site link */}
        {(data.favourites || data.siteUrl) && (
          <View className="mt-[18px] flex-row flex-wrap items-center gap-[9px]">
            {data.favourites && (
              <View className="rounded-full bg-[rgba(253,164,175,0.12)] px-[11px] py-2">
                <Text className="text-[11px] font-bold text-[#fbb6c2]">
                  ♥ {data.favourites.toLocaleString()} favourites
                </Text>
              </View>
            )}
            {data.siteUrl && (
              <ScalePressable
                onPress={() => Linking.openURL(data.siteUrl!)}
                className="rounded-full bg-[#d9ff9f] px-[13px] py-[9px]">
                <Text className="text-[11px] font-extrabold text-[#182008]">
                  Open AniList profile
                </Text>
              </ScalePressable>
            )}
          </View>
        )}

        {works.length > 0 && (
          <RowItem
            className="-mx-4 mt-3"
            data={works}
            staticData={works}
            name="Famous Works"
            seeAll
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  staffPortrait: { width: 130, height: 160 },
  characterImageFrame: { width: 166, height: 166 },
  characterPortrait: { width: '100%', height: '100%' },
});
