import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { hp, wp } from '~/helpers/common';

const Gradient = () => {
  return (
    <View pointerEvents="none" style={[styles.gradient, { width: wp(100), height: hp(56) }]}>
      {/* Subtle dark scrim */}
      <LinearGradient
        colors={['rgba(10,10,14,0.25)', 'rgba(10,10,14,0.08)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Top fade */}
      <LinearGradient
        colors={['rgba(10,10,14,0.85)', 'rgba(10,10,14,0.35)', 'transparent']}
        style={styles.topFade}
      />
      {/* Deep bottom fade */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(10,10,14,0.18)',
          'rgba(10,10,14,0.62)',
          'rgba(10,10,14,0.92)',
          'rgba(10,10,14,1)',
        ]}
        locations={[0, 0.35, 0.6, 0.82, 1]}
        style={styles.bottomFade}
      />
    </View>
  );
};

export default Gradient;

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 90,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: hp(38),
  },
});
