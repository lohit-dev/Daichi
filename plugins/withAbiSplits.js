const { withAppBuildGradle } = require('@expo/config-plugins');

const ABI_SPLIT_BLOCK = `
    // Daichi: generate one APK per ABI plus a universal APK from one release build.
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
            universalApk true
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') return modConfig;
    if (modConfig.modResults.contents.includes('Daichi: generate one APK per ABI')) {
      return modConfig;
    }

    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      /^android\s*\{/m,
      `android {${ABI_SPLIT_BLOCK}`
    );

    return modConfig;
  });
};
