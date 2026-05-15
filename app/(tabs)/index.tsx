import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, LayoutAnimation, Platform, Share,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, UIManager, View,
} from 'react-native';
import { LABELS, EXTRA_INFO, CONTRIB_LABELS, LabelKey } from '../shared/labels';
import { palette } from '../shared/theme';
import { compressImage } from '../shared/compressImage';
import { interpretThc } from '../shared/thcInterpretation';

// Enable LayoutAnimation on Android (no-op on iOS)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API = 'https://phytolens-backend-production.up.railway.app';

// Wrapper that no-ops on web (Haptics throws there)
const haptic = {
  light:    () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium:   () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success:  () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning:  () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error:    () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
const HISTORY_KEY = 'trichai_history_v1';
const MAX_HISTORY = 50;


type Screen = 'home' | 'result' | 'history' | 'historyDetail' | 'contribute';

export default function HomeScreen() {
  const [screen, setScreen]           = useState<Screen>('home');
  const [image, setImage]             = useState<any>(null);
  const [result, setResult]           = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [history, setHistory]         = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [contribLabel, setContribLabel] = useState('');
  const [contribSent, setContribSent]   = useState(false);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribError, setContribError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then(raw => {
        if (raw) {
          try { setHistory(JSON.parse(raw)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const persistHistory = (h: any[]) => {
    setHistory(h);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h)).catch(() => {});
  };

  const pickImage = async () => {
    haptic.light();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      haptic.warning();
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled) {
      haptic.success();
      const asset = res.assets[0];
      const compressedUri = await compressImage(asset);
      setImage({ ...asset, uri: compressedUri });
      setResult(null); setScreen('home');
    }
  };

  const takePhoto = async () => {
    haptic.light();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      haptic.warning();
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled) {
      haptic.success();
      const asset = res.assets[0];
      const compressedUri = await compressImage(asset);
      setImage({ ...asset, uri: compressedUri });
      setResult(null); setScreen('home');
    }
  };

  const analyze = async () => {
    if (!image) return;
    haptic.medium();
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: image.uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      const res  = await fetch(`${API}/analyze`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        haptic.error();
        Alert.alert('Error', data.detail || 'No se pudo analizar.');
        return;
      }
      if (data.success) {
        haptic.success();
        setResult(data.result);
        const entry = {
          id:       Date.now(),
          date:     new Date().toLocaleString('es-ES'),
          result:   data.result,
          imageUri: image.uri,
        };
        const updated = [entry, ...history].slice(0, MAX_HISTORY);
        persistHistory(updated);
        setScreen('result');
      } else {
        haptic.error();
        Alert.alert('Error', 'No se pudo analizar.');
      }
    } catch {
      haptic.error();
      Alert.alert('Error', 'No se puede conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const contribute = async () => {
    if (!image || !contribLabel) return;
    setContribLoading(true);
    setContribError('');
    try {
      const form = new FormData();
      form.append('file', { uri: image.uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      form.append('label', contribLabel);
      const res = await fetch(`${API}/contribute`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error('rejected');
      haptic.success();
      setContribSent(true);
    } catch {
      haptic.error();
      setContribError('No se pudo enviar la foto. Inténtalo de nuevo.');
    } finally {
      setContribLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setContribLabel('');
    setContribSent(false);
    setContribError('');
    setScreen('home');
  };

  const clearHistory = () => {
    Alert.alert('Borrar historial', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => { persistHistory([]); setScreen('home'); } },
    ]);
  };

  // ── HISTORY DETAIL ──
  if (screen === 'historyDetail' && selectedHistory) {
    const item = selectedHistory;
    const cfg  = LABELS[item.result.label as LabelKey];
    const extra = EXTRA_INFO[item.result.label as LabelKey];
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => setScreen('history')} style={s.backRow}>
          <Text style={s.backBtn}>← Historial</Text>
        </TouchableOpacity>
        <Text style={s.historyDateBig}>🕐 {item.date}</Text>
        <ResultCard result={item.result} cfg={cfg} extra={extra} imageUri={item.imageUri} />
        <TouchableOpacity style={s.secondaryBtn} onPress={() => { setScreen('contribute'); setImage({ uri: item.imageUri }); }}>
          <Text style={s.secondaryBtnText}>¿Resultado incorrecto? Corregirlo →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── HISTORY LIST ──
  if (screen === 'history') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => setScreen('home')}><Text style={s.backBtn}>← Volver</Text></TouchableOpacity>
          <Text style={s.topTitle}>Historial</Text>
          <TouchableOpacity onPress={clearHistory}><Text style={s.clearBtn}>Borrar</Text></TouchableOpacity>
        </View>
        {history.length === 0
          ? (
              <View style={s.emptyHistory}>
                <Text style={s.emptyHistoryEmoji}>📷</Text>
                <Text style={s.emptyHistoryTitle}>Aún no has analizado nada</Text>
                <Text style={s.emptyHistorySub}>Cada análisis se guarda aquí automáticamente.{'\n'}Tu historial vive en este dispositivo.</Text>
                <TouchableOpacity style={s.emptyHistoryBtn} onPress={() => setScreen('home')}>
                  <Text style={s.emptyHistoryBtnText}>Analizar mi primera foto →</Text>
                </TouchableOpacity>
              </View>
            )
          : history.map((item: any) => {
              const c = LABELS[item.result.label as LabelKey];
              return (
                <TouchableOpacity key={item.id} style={[s.historyItem, { borderColor: c.color }]} onPress={() => { setSelectedHistory(item); setScreen('historyDetail'); }}>
                  {item.imageUri && <Image source={{ uri: item.imageUri }} style={s.historyThumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.historyLabel, { color: c.color }]}>{c.emoji} {item.result.display}</Text>
                    <Text style={s.historyMeta}>Confianza: {(item.result.confidence * 100).toFixed(1)}% · THC: {item.result.thc_estimate}%</Text>
                    <Text style={s.historyDate}>🕐 {item.date}</Text>
                  </View>
                  <Text style={s.historyArrow}>›</Text>
                </TouchableOpacity>
              );
            })
        }
      </ScrollView>
    );
  }

  // ── CONTRIBUTE ──
  if (screen === 'contribute') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={reset} style={s.backRow}><Text style={s.backBtn}>← Volver</Text></TouchableOpacity>
        <Text style={s.title}>🔬 TrichAI</Text>
        <View style={s.contributeInfo}>
          <Text style={s.contributeInfoText}>Cada foto que subas entrena la IA y la hace más precisa para todos.</Text>
        </View>

        {contribSent ? (
          <View style={s.successBox}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>🙌</Text>
            <Text style={s.successTitle}>¡Gracias por contribuir!</Text>
            <Text style={s.successSub}>Tu foto ayuda a mejorar TrichAI.</Text>
            <TouchableOpacity style={s.analyzeBtn} onPress={reset}>
              <Text style={s.analyzeBtnText}>Contribuir otra</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.camBtn} onPress={takePhoto}><Text style={s.camBtnIcon}>📷</Text><Text style={s.camBtnText}>Cámara</Text></TouchableOpacity>
              <TouchableOpacity style={s.camBtn} onPress={pickImage}><Text style={s.camBtnIcon}>🖼️</Text><Text style={s.camBtnText}>Galería</Text></TouchableOpacity>
            </View>
            {image && <Image source={{ uri: image.uri }} style={s.preview} />}

            <Text style={s.labelTitle}>¿Qué hay en la foto?</Text>
            <View style={s.labelGrid}>
              {Object.entries(CONTRIB_LABELS).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.labelBtn, contribLabel === key && { borderColor: val.color }]}
                  onPress={() => { haptic.light(); setContribLabel(key); }}
                >
                  <Text style={[s.labelBtnEmoji]}>{val.emoji}</Text>
                  <Text style={[s.labelBtnText, contribLabel === key && { color: val.color, fontWeight: '700' }]}>{val.text}</Text>
                  <Text style={s.labelBtnHelp}>{val.help}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {contribError ? <Text style={s.errorText}>{contribError}</Text> : null}

            <TouchableOpacity
              style={[s.analyzeBtn, (!image || !contribLabel || contribLoading) && s.analyzeBtnDisabled]}
              onPress={contribute}
              disabled={!image || !contribLabel || contribLoading}
            >
              {contribLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.analyzeBtnText}>Enviar foto</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  const shareResultNative = async (res: any, cfg: any, extra: any) => {
    const text = [
      `🔬 TrichAI — ${res.display}`,
      `Confianza: ${(res.confidence * 100).toFixed(0)}%  ·  Calidad: ${res.quality}`,
      `THC estimado: ${res.thc_estimate}% (${res.thc_min}–${res.thc_max}%)`,
      `CBD típico: ${extra.cbd}`,
      `Efectos: ${extra.effects.join(', ')}`,
      res.visual_traits ? `Tricomas: ${res.visual_traits.trichomes}  ·  Textura: ${res.visual_traits.texture}` : '',
      `\nAnaliza la tuya gratis → https://trichai.xyz`,
    ].filter(Boolean).join('\n');
    try {
      await Share.share({ message: text, title: `TrichAI — ${res.display}` });
    } catch {}
  };

  // ── RESULT ──
  if (screen === 'result' && result) {
    const cfg   = LABELS[result.label as LabelKey];
    const extra = EXTRA_INFO[result.label as LabelKey];
    const isNotDetected = result.label === 'other';
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>🔬 TrichAI</Text>
        <ResultCard result={result} cfg={cfg} extra={extra} imageUri={image?.uri} />
        {!isNotDetected && (
          <TouchableOpacity
            style={[s.analyzeBtn, { backgroundColor: cfg.color }]}
            onPress={() => { haptic.light(); shareResultNative(result, cfg, extra); }}
          >
            <Text style={s.analyzeBtnText}>↑ Compartir resultado</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.analyzeBtn} onPress={reset}><Text style={s.analyzeBtnText}>📷 Analizar otra foto</Text></TouchableOpacity>
        {!isNotDetected && (
          <TouchableOpacity style={s.secondaryBtn} onPress={() => setScreen('contribute')}>
            <Text style={s.secondaryBtnText}>¿Resultado incorrecto? Corrígelo →</Text>
          </TouchableOpacity>
        )}
        {history.length > 0 && (
          <TouchableOpacity style={s.historyBtnRow} onPress={() => setScreen('history')}>
            <Text style={s.historyBtnText}>📋 Ver historial ({history.length})</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ── HOME ──
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.homeHeader}>
        <View>
          <Text style={s.title}>🔬 TrichAI</Text>
          <Text style={s.subtitle}>Identificación inteligente de cannabis</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity style={s.historyBadge} onPress={() => setScreen('history')}>
            <Text style={s.historyBadgeText}>📋 {history.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.camBtn} onPress={takePhoto}><Text style={s.camBtnIcon}>📷</Text><Text style={s.camBtnText}>Cámara</Text></TouchableOpacity>
        <TouchableOpacity style={s.camBtn} onPress={pickImage}><Text style={s.camBtnIcon}>🖼️</Text><Text style={s.camBtnText}>Galería</Text></TouchableOpacity>
      </View>

      {image && <Image source={{ uri: image.uri }} style={s.preview} />}

      {image ? (
        <>
          <TouchableOpacity style={[s.analyzeBtn, loading && s.analyzeBtnDisabled]} onPress={analyze} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.analyzeBtnText}>Analizar imagen</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => setScreen('contribute')}>
            <Text style={s.secondaryBtnText}>Contribuir esta foto a la IA →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={s.placeholder}>
          <Text style={s.placeholderEmoji}>🔬</Text>
          <Text style={s.placeholderText}>Haz una foto o elige una de la galería para identificar el tipo, calidad y efectos</Text>
          <TouchableOpacity style={s.contributeSmallBtn} onPress={() => setScreen('contribute')}>
            <Text style={s.contributeSmallText}>¿Quieres mejorar la IA? Contribuye una foto →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function ResultCard({ result, cfg, extra, imageUri }: { result: any; cfg: any; extra: any; imageUri?: string }) {
  const [thcOpen, setThcOpen]   = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const thcDetail = interpretThc(result);
  const animateNext = () => {
    LayoutAnimation.configureNext({
      duration: 250,
      create:  { type: 'easeInEaseOut', property: 'opacity' },
      update:  { type: 'easeInEaseOut' },
    });
  };
  const toggleThc  = () => { if (!thcDetail) return; animateNext(); setThcOpen(o => !o); };
  const toggleMore = () => { animateNext(); setMoreOpen(o => !o); };
  const toggleTech = () => { animateNext(); setTechOpen(o => !o); };
  if (result.label === 'other') {
    return (
      <View style={[s.result, { borderColor: palette.border }]}>
        {imageUri && <Image source={{ uri: imageUri }} style={s.resultImage} />}
        <View style={s.resultHeader}>
          <Text style={s.resultEmoji}>🚫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.resultLabel, { color: palette.text }]}>No veo cannabis aquí</Text>
            <Text style={s.resultConf}>No parece haber cogollo, hachís ni planta. Puede que sea una mano, un fondo u otra cosa que el modelo no reconoce.</Text>
          </View>
        </View>
        <View style={s.notDetectedTipsBox}>
          <Text style={s.notDetectedTipsTitle}>Cómo mejorar la foto</Text>
          <Text style={s.notDetectedTip}>• Acércate y ocupa el centro</Text>
          <Text style={s.notDetectedTip}>• Buena luz, preferible natural</Text>
          <Text style={s.notDetectedTip}>• Enfoque nítido, fondo limpio</Text>
        </View>
      </View>
    );
  }
  const conf = result.confidence * 100;
  return (
    <View style={[s.result, { borderColor: cfg.color }]}>
      {imageUri && <Image source={{ uri: imageUri }} style={s.resultImage} />}

      <View style={s.resultHeader}>
        <Text style={s.resultEmoji}>{cfg.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.resultLabel, { color: cfg.color }]}>{result.display}</Text>
          <Text style={s.resultConf}>Confianza: {conf.toFixed(1)}%</Text>
          {conf < 70 && (
            <Text style={s.lowConfWarning}>⚠️ Confianza baja. Este resultado puede ser incorrecto.</Text>
          )}
          <View style={s.qualityRow}>
            <View style={[s.qualityDot, { backgroundColor: conf >= 85 ? palette.green : conf >= 65 ? '#FF9800' : '#f44336' }]} />
            <Text style={s.resultQuality}>Calidad: {result.quality}</Text>
          </View>
        </View>
      </View>

      <View style={s.thcRow}>
        <TouchableOpacity
          activeOpacity={thcDetail ? 0.7 : 1}
          onPress={toggleThc}
          disabled={!thcDetail}
          style={[s.thcBox, { flex: 1, borderWidth: 1, borderColor: thcOpen ? cfg.color + '55' : 'transparent' }]}
        >
          <Text style={s.thcTitle}>THC típico</Text>
          <Text style={[s.thcValue, { color: cfg.color, fontSize: 19 }]}>{result.thc_min}% — {result.thc_max}%</Text>
          {thcDetail && (
            <Text style={s.thcExpandHint}>{thcOpen ? 'Ocultar detalle ▲' : 'Toca para ver detalle ▼'}</Text>
          )}
        </TouchableOpacity>
        <View style={[s.thcBox, { flex: 1, marginLeft: 8 }]}>
          <Text style={s.thcTitle}>CBD típico</Text>
          <Text style={[s.thcValue, { color: '#aaa', fontSize: 17 }]}>{extra.cbd}</Text>
        </View>
      </View>
      {thcDetail && thcOpen && (
        <View style={[s.thcDetailBox, { borderColor: cfg.color + '33' }]}>
          {thcDetail.lowConf && (
            <Text style={s.thcDetailLowConf}>⚠ Confianza baja del modelo. Esta interpretación es orientativa.</Text>
          )}
          <Text style={s.thcDetailSection}>RASGOS DETECTADOS</Text>
          {thcDetail.traits.map(t => (
            <Text key={t.key} style={s.thcDetailItem}>
              <Text style={s.thcDetailItemLabel}>{t.label}: </Text>
              <Text style={[s.thcDetailItemValue, { color: cfg.color }]}>{t.value}</Text>
              {t.sub && t.sub !== '—' ? <Text style={s.thcDetailItemSub}> · {t.sub}</Text> : null}
            </Text>
          ))}
          <Text style={[s.thcDetailSection, { marginTop: 12 }]}>INTERPRETACIÓN</Text>
          <Text style={s.thcDetailText}>{thcDetail.interpretation}</Text>
          <Text style={s.thcDetailDisclaimer}>⚠ Estimación visual. No sustituye análisis de laboratorio.</Text>
        </View>
      )}

      <Text style={s.description}>{result.description}</Text>

      {/* Lvl 4 — Aviso obligatorio (siempre visible) */}
      <View style={s.moderationBox}>
        <Text style={s.moderationTitle}>Moderación</Text>
        <Text style={s.moderationText}>{extra.moderation}</Text>
      </View>

      {/* Lvl 3 — Más detalle (colapsable) */}
      <TouchableOpacity activeOpacity={0.7} onPress={toggleMore} style={s.disclosureBtn} accessibilityRole="button" accessibilityState={{ expanded: moreOpen }}>
        <Text style={s.disclosureLabel}>Más detalle</Text>
        <Text style={[s.disclosureChevron, moreOpen && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
      </TouchableOpacity>
      {moreOpen && (
        <View style={s.disclosureInner}>
          <Text style={s.sectionTitle}>Efectos</Text>
          <View style={s.badgeRow}>{extra.effects.map((e: string) => <View key={e} style={[s.badge, { borderColor: cfg.color }]}><Text style={[s.badgeText, { color: cfg.color }]}>{e}</Text></View>)}</View>

          <Text style={s.sectionTitle}>Aroma</Text>
          <View style={s.badgeRow}>{extra.aroma.map((a: string) => <View key={a} style={[s.badge, { borderColor: '#555' }]}><Text style={[s.badgeText, { color: '#888' }]}>{a}</Text></View>)}</View>

          <Text style={s.sectionTitle}>Consumo</Text>
          <View style={s.badgeRow}>{extra.consumption.map((c: string) => <View key={c} style={[s.badge, { borderColor: '#444' }]}><Text style={[s.badgeText, { color: '#666' }]}>{c}</Text></View>)}</View>

          <Text style={s.sectionTitle}>Variedades comunes</Text>
          <View style={s.badgeRow}>{result.varieties.map((v: string) => <View key={v} style={[s.badge, { borderColor: cfg.color }]}><Text style={[s.badgeText, { color: cfg.color }]}>{v}</Text></View>)}</View>

          <View style={s.tipBox}>
            <Text style={s.tipText}>{extra.tip}</Text>
          </View>
        </View>
      )}

      {/* Lvl 5 — Análisis técnico (colapsable) */}
      <TouchableOpacity activeOpacity={0.7} onPress={toggleTech} style={s.disclosureBtn} accessibilityRole="button" accessibilityState={{ expanded: techOpen }}>
        <Text style={s.disclosureLabel}>Análisis técnico</Text>
        <Text style={[s.disclosureChevron, techOpen && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
      </TouchableOpacity>
      {techOpen && (
        <View style={s.disclosureInner}>
          {result.visual_traits && (
            <>
              <Text style={s.sectionTitle}>Rasgos visuales</Text>
              <View style={s.traitsGrid}>
                <View style={s.traitBox}>
                  <Text style={s.traitLabel}>Tricomas</Text>
                  <Text style={s.traitValue}>{result.visual_traits.trichomes}</Text>
                  <Text style={s.traitSub}>{result.visual_traits.trichome_coverage.toFixed(1)}% cobertura</Text>
                </View>
                <View style={s.traitBox}>
                  <Text style={s.traitLabel}>Textura</Text>
                  <Text style={s.traitValue}>{result.visual_traits.texture}</Text>
                  <Text style={s.traitSub}>Rugosidad {result.visual_traits.roughness.toFixed(0)}/100</Text>
                </View>
                <View style={s.traitBox}>
                  <Text style={s.traitLabel}>Curación</Text>
                  <Text style={s.traitValue}>{result.visual_traits.cure}</Text>
                  <Text style={s.traitSub}>Brillo {result.visual_traits.brightness.toFixed(0)}%</Text>
                </View>
                <View style={s.traitBox}>
                  <Text style={s.traitLabel}>Color base</Text>
                  <View style={[s.colorDot, { backgroundColor: `rgb(${result.visual_traits.dominant_color.join(',')})` }]} />
                  <Text style={s.traitSub}>RGB dominante</Text>
                </View>
              </View>
            </>
          )}

          <Text style={s.sectionTitle}>Probabilidades</Text>
          {Object.entries(result.all_probs).map(([key, val]: [string, any]) => (
            <View key={key} style={s.barRow}>
              <Text style={s.barLabel}>{LABELS[key as LabelKey].emoji} {LABELS[key as LabelKey].text}</Text>
              <View style={s.barBg}><View style={[s.barFill, { width: `${(val * 100).toFixed(0)}%` as any, backgroundColor: LABELS[key as LabelKey].color }]} /></View>
              <Text style={s.barVal}>{(val * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: palette.bg },
  content:            { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },

  homeHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:              { color: '#fff', fontSize: 26, fontWeight: '700' },
  subtitle:           { color: '#555', fontSize: 13, marginTop: 4 },
  historyBadge:       { backgroundColor: palette.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#222' },
  historyBadgeText:   { color: '#666', fontSize: 13 },

  btnRow:             { flexDirection: 'row', gap: 12, marginBottom: 16 },
  camBtn:             { flex: 1, backgroundColor: palette.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  camBtnIcon:         { fontSize: 28, marginBottom: 4 },
  camBtnText:         { color: '#aaa', fontSize: 13 },
  preview:            { width: '100%', height: 260, borderRadius: 12, marginBottom: 16 },
  analyzeBtn:         { backgroundColor: palette.green, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzeBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn:       { backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  secondaryBtnText:   { color: '#555', fontSize: 13 },
  historyBtnRow:      { backgroundColor: palette.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12 },
  historyBtnText:     { color: '#666', fontSize: 14 },
  placeholder:        { alignItems: 'center', marginTop: 32, padding: 24 },
  placeholderEmoji:   { fontSize: 48, marginBottom: 16 },
  placeholderText:    { color: '#444', textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  contributeSmallBtn: { borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 12 },
  contributeSmallText:{ color: '#444', fontSize: 13, textAlign: 'center' },

  backRow:            { marginBottom: 16 },
  backBtn:            { color: palette.green, fontSize: 15 },
  topBar:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  topTitle:           { color: '#fff', fontSize: 18, fontWeight: '700' },
  clearBtn:           { color: '#f44336', fontSize: 14 },
  historyItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 12 },
  historyThumb:       { width: 56, height: 56, borderRadius: 8 },
  historyLabel:       { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  historyMeta:        { color: '#666', fontSize: 12, marginBottom: 3 },
  historyDate:        { color: '#444', fontSize: 11 },
  historyArrow:       { color: '#333', fontSize: 22 },
  historyDateBig:     { color: '#444', fontSize: 12, marginBottom: 12 },
  emptyText:          { color: '#444', textAlign: 'center', marginTop: 60, fontSize: 15 },
  emptyHistory:       { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyHistoryEmoji:  { fontSize: 48, marginBottom: 18, opacity: 0.6 },
  emptyHistoryTitle:  { color: palette.text, fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyHistorySub:    { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  emptyHistoryBtn:    { backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.4)', borderRadius: 980, paddingHorizontal: 20, paddingVertical: 10 },
  emptyHistoryBtnText:{ color: palette.green, fontSize: 13, fontWeight: '600' },

  contributeInfo:     { backgroundColor: '#111', borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  contributeInfoText: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  labelTitle:         { color: '#666', fontSize: 13, marginBottom: 10, marginTop: 4 },
  labelGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  labelBtn:           { width: '48%', padding: 14, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, alignItems: 'center', minHeight: 96 },
  labelBtnEmoji:      { fontSize: 22, marginBottom: 4 },
  labelBtnText:       { color: '#aaa', fontSize: 13, fontWeight: '600' },
  labelBtnHelp:       { color: '#555', fontSize: 11, marginTop: 4, textAlign: 'center', lineHeight: 14 },
  notDetectedTipsBox: { backgroundColor: '#0d0d0d', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  notDetectedTipsTitle: { color: palette.text, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  notDetectedTip:     { color: palette.muted, fontSize: 13, lineHeight: 22 },
  errorText:          { color: '#f44336', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  successBox:         { alignItems: 'center', paddingVertical: 32 },
  successTitle:       { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  successSub:         { color: '#555', fontSize: 14, marginBottom: 24 },

  result:             { borderWidth: 1.5, borderRadius: 16, padding: 16, marginBottom: 16 },
  resultImage:        { width: '100%', height: 200, borderRadius: 10, marginBottom: 16 },
  resultHeader:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
  resultEmoji:        { fontSize: 40 },
  resultLabel:        { fontSize: 22, fontWeight: '700' },
  resultConf:         { color: '#aaa', fontSize: 13, marginTop: 4 },
  lowConfWarning:     { color: '#f5a623', fontSize: 12, marginTop: 6, backgroundColor: '#1a1200', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  qualityRow:         { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  qualityDot:         { width: 8, height: 8, borderRadius: 4 },
  resultQuality:      { color: '#aaa', fontSize: 12 },
  thcRow:             { flexDirection: 'row', marginBottom: 16 },
  thcBox:             { backgroundColor: '#111', borderRadius: 10, padding: 12, alignItems: 'center' },
  thcTitle:           { color: '#666', fontSize: 11, marginBottom: 4 },
  thcValue:           { fontSize: 26, fontWeight: '700' },
  thcRange:           { color: '#444', fontSize: 11, marginTop: 4 },
  thcExpandHint:      { color: '#555', fontSize: 11, marginTop: 6, letterSpacing: 0.2 },
  thcDetailBox:       { backgroundColor: '#0a0a0a', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 14 },
  thcDetailLowConf:   { color: '#f5a623', fontSize: 12, marginBottom: 12, backgroundColor: '#1a1200', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  thcDetailSection:   { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  thcDetailItem:      { color: '#aaa', fontSize: 13, marginBottom: 5, lineHeight: 20 },
  thcDetailItemLabel: { color: '#888' },
  thcDetailItemValue: { fontWeight: '700' },
  thcDetailItemSub:   { color: '#555', fontSize: 12 },
  thcDetailText:      { color: '#ccc', fontSize: 13, marginBottom: 14, lineHeight: 20 },
  thcDetailDisclaimer:{ color: '#555', fontSize: 11, fontStyle: 'italic' },

  disclosureBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  disclosureLabel:  { color: '#ccc', fontSize: 14, fontWeight: '500', letterSpacing: -0.1 },
  disclosureChevron:{ color: '#555', fontSize: 14 },
  disclosureInner:  { paddingTop: 4, paddingBottom: 8 },
  description:        { color: '#888', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  sectionTitle:       { color: '#666', fontSize: 11, fontWeight: '600', marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge:              { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:          { fontSize: 12, fontWeight: '500' },
  moderationBox:      { backgroundColor: '#1a0f00', borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FF9800' },
  moderationTitle:    { color: '#FF9800', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  moderationText:     { color: '#aaa', fontSize: 13, lineHeight: 18 },
  tipBox:             { backgroundColor: '#0f1a0f', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2a4a2a' },
  tipText:            { color: '#8BC34A', fontSize: 13, lineHeight: 18 },
  traitsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  traitBox:           { width: '48%', backgroundColor: '#111', borderRadius: 10, padding: 12, alignItems: 'center' },
  traitLabel:         { color: '#555', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  traitValue:         { color: '#ddd', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  traitSub:           { color: '#444', fontSize: 11 },
  colorDot:           { width: 24, height: 24, borderRadius: 12, marginVertical: 4, borderWidth: 1, borderColor: '#333' },

  barRow:             { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel:           { color: '#666', fontSize: 11, width: 110 },
  barBg:              { flex: 1, height: 5, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  barFill:            { height: '100%', borderRadius: 3 },
  barVal:             { color: '#555', fontSize: 11, width: 38, textAlign: 'right' },
});
