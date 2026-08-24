import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Notification,
  Profile2User,
  SecuritySafe,
  VideoPlay,
  ArrowRight2,
  Moon,
  Logout,
  Code1,
} from 'iconsax-react-native';
import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Switch,
  Image,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScalePressable from '~/components/shared/ScalePressable';

const Settings = () => {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  // Dev mode password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogout = () => {
    //
  };

  const handleOpenDevPlayer = () => {
    setPasswordInput('');
    setPasswordError('');
    setIsPasswordModalOpen(true);
  };

  const handleSubmitPassword = () => {
    if (passwordInput.trim().toLowerCase() === 'mangarock') {
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setPasswordError('');
      router.push({
        pathname: '/anime/watch/[episodeId]',
        params: {
          episodeId: '8',
          animeId: '21355',
          type: 'sub',
          animeTitle: 'Re:ZERO -Starting Life in Another World-',
          malId: '31240',
          episodeTitle: 'The End of the Beginning and the Beginning of the End',
        },
      });
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const settingsOptions = [
    {
      icon: <Profile2User size={24} color="#a3e635" variant="Bold" />,
      title: 'Profile',
      subtitle: 'Edit your profile',
      onPress: () => {},
    },
    {
      icon: <SecuritySafe size={24} color="#a3e635" variant="Bold" />,
      title: 'Security',
      subtitle: 'Change password & security settings',
      onPress: () => {},
    },
    {
      icon: <VideoPlay size={24} color="#a3e635" variant="Bold" />,
      title: 'Auto-Play',
      subtitle: 'Control video auto-play',
      rightElement: (
        <Switch
          value={autoPlay}
          onValueChange={setAutoPlay}
          trackColor={{ false: '#525252', true: '#a3e635' }}
          thumbColor={autoPlay ? '#fff' : '#f4f3f4'}
        />
      ),
    },
    {
      icon: <Moon size={24} color="#a3e635" variant="Bold" />,
      title: 'Dark Mode',
      subtitle: 'Toggle app theme',
      rightElement: (
        <Switch
          value={isDarkMode}
          onValueChange={setIsDarkMode}
          trackColor={{ false: '#525252', true: '#a3e635' }}
          thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
        />
      ),
    },
    {
      icon: <Notification size={24} color="#a3e635" variant="Bold" />,
      title: 'Notifications',
      subtitle: 'Manage notifications',
      rightElement: (
        <Switch
          value={notifications}
          onValueChange={setNotifications}
          trackColor={{ false: '#525252', true: '#a3e635' }}
          thumbColor={notifications ? '#fff' : '#f4f3f4'}
        />
      ),
    },
    {
      icon: <Code1 size={24} color="#a3e635" variant="Bold" />,
      title: 'Dev: Test Episode Player',
      subtitle: 'Detective Conan (Ep 1) test stream',
      onPress: handleOpenDevPlayer,
    },
    {
      icon: <Logout size={24} color="#ef4444" variant="Bold" />,
      title: 'Logout',
      subtitle: 'Sign out of your account',
      onPress: handleLogout,
    },
  ];

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-neutral-950">
      <View className="relative">
        <LinearGradient
          colors={['rgba(163, 230, 53, 0.2)', 'transparent']}
          className="absolute h-72 w-full rounded-full"
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        <View className="mt-16 items-center px-6 pt-8">
          <Animated.View entering={FadeInDown.delay(100)} className="items-center">
            <Image
              source={{ uri: 'https://your-default-avatar-url.com' }}
              className="h-24 w-24 rounded-full border-2 border-lime-400"
            />
            <Text className="mt-2 font-salsa text-2xl text-white">John Doe</Text>
            <Text className="font-salsa text-sm text-neutral-400">john.doe@example.com</Text>
          </Animated.View>
        </View>

        <View className="p-6">
          {settingsOptions.map((option, index) => (
            <Animated.View key={option.title} entering={FadeInDown.delay(index * 100)}>
              <ScalePressable
                onPress={option.onPress}
                scaleTo={0.97}
                className="mb-4 flex-row items-center rounded-xl bg-neutral-900 p-4">
                <View className="mr-4 rounded-full bg-lime-500/20 p-2">{option.icon}</View>
                <View className="flex-1">
                  <Text className="font-salsa text-lg text-white">{option.title}</Text>
                  <Text className="font-salsa text-sm text-neutral-400">{option.subtitle}</Text>
                </View>
                {option.rightElement || <ArrowRight2 size={20} color="#a3e635" />}
              </ScalePressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* Dev Password Modal */}
      <Modal
        visible={isPasswordModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPasswordModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 items-center justify-center bg-black/75 px-6">
          <View className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <Text className="font-salsa text-xl text-white">Developer Mode</Text>
            <Text className="mt-1 text-sm text-neutral-400">
              Enter the developer password to access the test episode player.
            </Text>

            <TextInput
              value={passwordInput}
              onChangeText={(text) => {
                setPasswordInput(text);
                if (passwordError) setPasswordError('');
              }}
              placeholder="Enter password"
              placeholderTextColor="#737373"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              className="mt-4 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white"
            />

            {passwordError ? (
              <Text className="mt-2 text-xs text-red-400">{passwordError}</Text>
            ) : null}

            <View className="mt-6 flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => setIsPasswordModalOpen(false)}
                className="rounded-xl px-4 py-2.5">
                <Text className="font-salsa text-neutral-400">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitPassword}
                className="rounded-xl bg-lime-400 px-5 py-2.5">
                <Text className="font-salsa font-bold text-neutral-950">Enter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default Settings;
