import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable, ScrollView, Animated, StyleSheet } from 'react-native';

import ScalePressable from '../shared/ScalePressable';

import { usePlayerStore } from '~/app/_store/usePlayerStore';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { Server, SubtitleTrack } from '~/types';

type SettingsSheetProps = {
  sheetAnim: Animated.Value;
  servers: Server[];
  activeServerIndex: number;
  validSubtitleTracks: SubtitleTrack[];
  onSelectServer: (index: number) => void;
};

const SettingsSheet = ({
  sheetAnim,
  servers,
  activeServerIndex,
  validSubtitleTracks,
  onSelectServer,
}: SettingsSheetProps) => {
  const isModalVisible = usePlayerStore((s) => s.isModalVisible);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const selectedSubtitleIndex = usePlayerStore((s) => s.selectedSubtitleIndex);
  const selectedQualityHeight = usePlayerStore((s) => s.selectedQualityHeight);
  const availableQualities = usePlayerStore((s) => s.availableQualities);

  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const setSelectedSubtitleIndex = usePlayerStore((s) => s.setSelectedSubtitleIndex);
  const setSelectedQualityHeight = usePlayerStore((s) => s.setSelectedQualityHeight);

  return (
    <Animated.View
      pointerEvents={isModalVisible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex: 2000 }]}>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsModalVisible(false)}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.7)', opacity: sheetAnim },
          ]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 max-h-[70%] rounded-t-3xl px-5 pb-8 pt-3"
        style={{
          backgroundColor: COLORS.surface,
          transform: [
            {
              translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [1000, 0] }),
            },
          ],
        }}>
        {/* Handle */}
        <View
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: COLORS.divider,
            marginBottom: 16,
          }}
        />

        {/* Tab bar */}
        <View
          className="mb-4 flex-row rounded-full p-1"
          style={{ backgroundColor: COLORS.surfaceRaised }}>
          {(['servers', 'subtitles', 'quality'] as const).map((tab) => (
            <ScalePressable
              key={tab}
              className="flex-1 items-center rounded-full py-2.5"
              style={{ backgroundColor: activeTab === tab ? COLORS.accent : 'transparent' }}
              scaleTo={0.97}
              onPress={() => setActiveTab(tab)}>
              <Text
                style={{
                  color: activeTab === tab ? COLORS.bg : COLORS.textMuted,
                  fontWeight: '700',
                  fontSize: 13,
                  textTransform: 'capitalize',
                }}>
                {tab}
              </Text>
            </ScalePressable>
          ))}
        </View>

        {/* Tab content */}
        <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
          {activeTab === 'servers' ? (
            <ServersTab
              servers={servers}
              activeServerIndex={activeServerIndex}
              onSelectServer={onSelectServer}
            />
          ) : activeTab === 'subtitles' ? (
            <SubtitlesTab
              tracks={validSubtitleTracks}
              selectedIndex={selectedSubtitleIndex}
              onSelect={(index) => {
                setSelectedSubtitleIndex(index);
                setIsModalVisible(false);
              }}
            />
          ) : (
            <QualityTab
              availableQualities={availableQualities}
              selectedHeight={selectedQualityHeight}
              onSelect={(height) => {
                setSelectedQualityHeight(height);
                setIsModalVisible(false);
              }}
            />
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Tab sub-components
// ---------------------------------------------------------------------------

const ServersTab = ({
  servers,
  activeServerIndex,
  onSelectServer,
}: {
  servers: Server[];
  activeServerIndex: number;
  onSelectServer: (index: number) => void;
}) => {
  if (servers.length === 0) {
    return (
      <View
        className="items-center rounded-xl p-4"
        style={{ backgroundColor: COLORS.surfaceRaised }}>
        <Text style={{ color: COLORS.textMuted }}>No servers available</Text>
      </View>
    );
  }

  return (
    <>
      {servers.map((server, index) => {
        const active = activeServerIndex === index;
        return (
          <Pressable
            key={index}
            className="mb-2 flex-row items-center justify-between rounded-xl p-3.5"
            style={{
              backgroundColor: COLORS.surfaceRaised,
              borderWidth: active ? 1.5 : 0,
              borderColor: COLORS.accent,
            }}
            onPress={() => onSelectServer(index)}>
            <Text style={{ color: COLORS.text, fontSize: 14 }}>{server.serverName}</Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: active ? COLORS.accent : COLORS.divider }}>
              <Text
                style={{
                  color: active ? COLORS.bg : COLORS.textMuted,
                  fontSize: 10,
                  fontWeight: '700',
                }}>
                {server.type.toUpperCase()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </>
  );
};

const SubtitlesTab = ({
  tracks,
  selectedIndex,
  onSelect,
}: {
  tracks: SubtitleTrack[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}) => {
  if (tracks.length === 0) {
    return (
      <View
        className="items-center rounded-xl p-4"
        style={{ backgroundColor: COLORS.surfaceRaised }}>
        <Text style={{ color: COLORS.textMuted }}>No subtitles available</Text>
      </View>
    );
  }

  return (
    <>
      {/* None option */}
      <Pressable
        className="mb-2 flex-row items-center justify-between rounded-xl p-3.5"
        style={{
          backgroundColor: COLORS.surfaceRaised,
          borderWidth: selectedIndex === null ? 1.5 : 0,
          borderColor: COLORS.accent,
        }}
        onPress={() => onSelect(null)}>
        <Text style={{ color: COLORS.text, fontSize: 14 }}>None</Text>
      </Pressable>

      {tracks.map((track, index) => {
        const active = selectedIndex === index;
        return (
          <Pressable
            key={index}
            className="mb-2 flex-row items-center justify-between rounded-xl p-3.5"
            style={{
              backgroundColor: COLORS.surfaceRaised,
              borderWidth: active ? 1.5 : 0,
              borderColor: COLORS.accent,
            }}
            onPress={() => onSelect(index)}>
            <Text style={{ color: COLORS.text, fontSize: 14 }}>{track.title}</Text>
            {active && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
          </Pressable>
        );
      })}
    </>
  );
};

const QualityTab = ({
  availableQualities,
  selectedHeight,
  onSelect,
}: {
  availableQualities: { height: number; label: string }[];
  selectedHeight: number;
  onSelect: (height: number) => void;
}) => (
  <>
    {/* Auto option */}
    <Pressable
      className="mb-2 flex-row items-center justify-between rounded-xl p-3.5"
      style={{
        backgroundColor: COLORS.surfaceRaised,
        borderWidth: selectedHeight === 0 ? 1.5 : 0,
        borderColor: COLORS.accent,
      }}
      onPress={() => onSelect(0)}>
      <Text style={{ color: COLORS.text, fontSize: 14 }}>Auto</Text>
      {selectedHeight === 0 && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
    </Pressable>

    {availableQualities.length === 0 ? (
      <View
        className="items-center rounded-xl p-4"
        style={{ backgroundColor: COLORS.surfaceRaised }}>
        <Text style={{ color: COLORS.textMuted, fontSize: 12, textAlign: 'center' }}>
          Quality is managed automatically.{'\n'}The player picks the best resolution for your
          connection.
        </Text>
      </View>
    ) : (
      availableQualities.map((quality) => {
        const active = selectedHeight === quality.height;
        return (
          <Pressable
            key={quality.height}
            className="mb-2 flex-row items-center justify-between rounded-xl p-3.5"
            style={{
              backgroundColor: COLORS.surfaceRaised,
              borderWidth: active ? 1.5 : 0,
              borderColor: COLORS.accent,
            }}
            onPress={() => onSelect(quality.height)}>
            <Text style={{ color: COLORS.text, fontSize: 14 }}>{quality.label}</Text>
            {active && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
          </Pressable>
        );
      })
    )}
  </>
);

export default SettingsSheet;
