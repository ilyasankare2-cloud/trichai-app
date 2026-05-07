# TrichAI App

Identificador de cannabis para Android e iOS. Haz una foto o elige una de la galería y obtén clasificación instantánea con IA, historial persistente y análisis visual.

[![Expo](https://img.shields.io/badge/Expo-SDK_53-000020)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://typescriptlang.org)

## Stack

Expo + React Native + TypeScript. Una sola pantalla (`app/(tabs)/index.tsx`) con una máquina de estados en vez de un stack de navegación. El historial se guarda en AsyncStorage bajo la clave `trichai_history_v1`.

## Ejecutar

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go. Listo.

## Pantallas

```
home → resultado → (volver a home)
     → contribuir
     → historial → detalle
```

Todas son renders condicionales dentro del mismo componente — sin librería de navegación.

## Build para producción

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Requiere cuenta de Expo y `eas.json` configurado. ID del paquete: `com.yasss0.trichai`

## Datos de la app

- Versión: 1.0.2
- Scheme de deep link: `trichai://`
- Permisos: Cámara, Galería
