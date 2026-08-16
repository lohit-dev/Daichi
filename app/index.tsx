import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  const router = useRouter();

  const handleRouting = () => router.push('/(tabs)/Home');

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1">
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <TouchableOpacity onPress={handleRouting}>
          <Text className="rounded-xl bg-lime-800 px-3 py-2 font-salsa text-4xl text-white">
            Go to Home Screen
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
