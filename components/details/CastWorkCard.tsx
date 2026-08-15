import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ScalePressable from '~/components/shared/ScalePressable';
import { CastWork } from '~/types';

type CastWorkCardProps = {
  work: CastWork;
  compact?: boolean;
};

const CastWorkCard = ({ work, compact = true }: CastWorkCardProps) => {
  const router = useRouter();

  return (
    <ScalePressable
      scaleTo={0.95}
      style={[styles.card, compact ? styles.compactCard : styles.gridCard]}
      onPress={() => router.push({ pathname: '/anime/[id]', params: { id: work.id } })}>
      <Animated.Image source={{ uri: work.image }} style={styles.image} />
      <View style={styles.scrim} />
      <View style={styles.cardCopy}>
        <Text style={styles.title} numberOfLines={2}>
          {work.title}
        </Text>
        {work.role ? (
          <Text style={styles.role} numberOfLines={1}>
            {work.role}
          </Text>
        ) : null}
      </View>
    </ScalePressable>
  );
};

export default CastWorkCard;

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#171a14' },
  compactCard: { width: 126, height: 178, marginRight: 10 },
  gridCard: { flex: 1, height: 210, marginBottom: 12 },
  image: { width: '100%', height: '100%', backgroundColor: '#1b1e18' },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardCopy: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  title: { color: '#fff', fontFamily: 'Salsa', fontSize: 14, fontWeight: '700' },
  role: { color: '#a3e635', fontFamily: 'Salsa', fontSize: 10, marginTop: 3 },
});
