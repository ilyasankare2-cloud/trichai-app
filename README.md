# TrichAI App

Mobile cannabis identifier for Android and iOS. Take a photo or pick from your gallery, get instant AI classification with history that persists between sessions.

[![Expo](https://img.shields.io/badge/Expo-SDK_53-000020)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://typescriptlang.org)

## Stack

Expo + React Native + TypeScript. Single screen (`app/(tabs)/index.tsx`) with a screen state machine instead of a navigation stack. History stored in AsyncStorage under `trichai_history_v1`.

## Running

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. That's it.

## Screens

```
home → result → (back to home)
     → contribute
     → history → historyDetail
```

All screens are conditional renders inside the same component — no navigation library involved.

## Building for production

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Requires an Expo account and `eas.json` configured. Package ID: `com.yasss0.trichai`

## App details

- Version: 1.0.2
- Deep link scheme: `trichai://`
- Permissions used: Camera, Media Library
