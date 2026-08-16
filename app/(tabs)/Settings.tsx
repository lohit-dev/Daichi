import { LinearGradient } from 'expo-linear-gradient';
import {
  Notification,
  Profile2User,
  SecuritySafe,
  VideoPlay,
  ArrowRight2,
  Moon,
  Logout,
} from 'iconsax-react-native';
import { useState } from 'react';
import { ScrollView, Text, View, Switch, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScalePressable from '~/components/shared/ScalePressable';

const Settings = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  // const _router = useRouter();

  const handleLogout = () => {
    //
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
    </SafeAreaView>
  );
};

export default Settings;
