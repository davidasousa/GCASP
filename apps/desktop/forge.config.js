const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'src', 'resources', 'gcasp-icon.ico'),
    executableName: 'GCASP',
    win32metadata: {
      CompanyName: 'G-CASP Team',
      FileDescription: 'Gaming Capture Application & Social Platform',
      OriginalFilename: 'GCASP.exe',
      ProductName: 'GCASP',
      InternalName: 'GCASP',
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'GCASP',
        setupIcon: path.join(__dirname, 'src', 'resources', 'gcasp-icon.ico')
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        devContentSecurityPolicy: "'default-src * connect-src self * 3001'",
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ]
};