import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as LegacyMediaLibrary from 'expo-media-library/legacy';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useToast } from 'react-native-toast-notifications';

import ScalePressable from '~/components/shared/ScalePressable';
import { hp, wp } from '~/helpers/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ImagePreviewModalProps = {
  visible: boolean;
  imageUrl?: string;
  title?: string;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ImagePreviewModal = ({ visible, imageUrl, title, onClose }: ImagePreviewModalProps) => {
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, { duration: 160 });
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      // Unmount after fade-out finishes
      const timer = setTimeout(() => setShouldRender(false), 120);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!shouldRender || !imageUrl) return null;

  // ---- Handlers ----

  const handleShare = async () => {
    try {
      await Share.share({
        title: title || 'Anime Poster',
        message: title ? `Check out ${title} on Daichi!` : 'Check this out on Daichi!',
        url: imageUrl,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        toast.show('Permission to access photos was denied', { type: 'danger' });
        return;
      }

      const cleanName = (title || 'poster').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const destFile = new File(Paths.cache, `${cleanName}.jpg`);
      const downloaded = await File.downloadFileAsync(imageUrl, destFile);

      try {
        await Asset.create(downloaded.uri);
      } catch {
        await LegacyMediaLibrary.saveToLibraryAsync(downloaded.uri);
      }

      toast.show('Poster saved to Photos', { type: 'success' });
    } catch (e) {
      console.error(e);
      toast.show('Could not save poster', { type: 'danger' });
    } finally {
      setIsDownloading(false);
    }
  };

  // ---- Render ----

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="box-none">
      {/* Tap-away backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Centred content */}
      <View style={styles.content} pointerEvents="box-none">
        {/* Full-bleed poster card */}
        <View style={styles.posterContainer}>
          <Image source={{ uri: imageUrl }} style={styles.posterImage} resizeMode="cover" />
        </View>

        {/* Title */}
        {title ? (
          <Text numberOfLines={2} style={styles.titleText}>
            {title}
          </Text>
        ) : null}

        {/* Share — Close — Save */}
        <View style={styles.actionsRow}>
          {/* Share */}
          <ScalePressable
            onPress={handleShare}
            scaleTo={0.88}
            haptic="light"
            style={styles.btn}
            accessibilityLabel="Share poster">
            <Ionicons name="share-social-outline" size={21} color="#fff" />
          </ScalePressable>

          {/* Close — lime accent, centre */}
          <ScalePressable
            onPress={onClose}
            scaleTo={0.88}
            haptic="light"
            style={[styles.btn, styles.btnAccent]}
            accessibilityLabel="Close preview">
            <Ionicons name="close" size={24} color="#0a0a0a" />
          </ScalePressable>

          {/* Download / Save */}
          <ScalePressable
            onPress={handleDownload}
            scaleTo={0.88}
            haptic="medium"
            style={styles.btn}
            disabled={isDownloading}
            accessibilityLabel="Save poster">
            {isDownloading ? (
              <ActivityIndicator size="small" color="#bef264" />
            ) : (
              <Ionicons name="download-outline" size={21} color="#fff" />
            )}
          </ScalePressable>
        </View>
      </View>
    </Animated.View>
  );
};

export default ImagePreviewModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 6, 5, 0.92)',
  },
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  posterContainer: {
    width: wp(86),
    height: hp(60),
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#141614',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  titleText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(225, 227, 222, 0.75)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccent: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#bef264',
  },
});
