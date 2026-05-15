import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LABELS, LabelKey } from '../shared/labels';
import { palette } from '../shared/theme';

const API = 'https://phytolens-backend-production.up.railway.app';
const VALID: LabelKey[] = ['bud', 'hash', 'plant', 'other'];

type Props = {
  image: { uri: string } | null;
  result: { label: string; confidence: number } | null;
  onTrack?: (event: string, params: Record<string, any>) => void;
};

/**
 * Discrete feedback prompt under a result screen. Mirrors web FeedbackPrompt:
 *   idle       -> "¿Te ha sido útil?  Sí / No, era..."
 *   correcting -> "¿Qué era realmente?  [4 chips]"
 *   done       -> "Gracias por mejorar TrichAI"
 *
 * Apple-style restraint: hairline divider, muted text, ghost buttons.
 */
export function FeedbackPrompt({ image, result, onTrack }: Props) {
  const [state, setState] = useState<'idle' | 'correcting' | 'done'>('idle');
  const [submitting, setSubmitting] = useState(false);

  if (!image || !result || !VALID.includes(result.label as LabelKey)) return null;

  const send = async (isCorrect: boolean, realLabel?: string) => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', { uri: image.uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      form.append('predicted', result.label);
      form.append('is_correct', isCorrect ? 'true' : 'false');
      form.append('confidence', String(result.confidence ?? 0));
      if (!isCorrect && realLabel) form.append('real_label', realLabel);
      await fetch(`${API}/feedback`, { method: 'POST', body: form });
      if (onTrack) {
        onTrack(isCorrect ? 'feedback_positive' : 'feedback_correction', {
          predicted: result.label,
          real:      realLabel || result.label,
        });
      }
    } catch {
      // Silently swallow — feedback is best-effort.
    } finally {
      setSubmitting(false);
      setState('done');
    }
  };

  if (state === 'done') {
    return (
      <View style={s.wrap}>
        <View style={s.thanks}>
          <Feather name="check" size={14} color={palette.green} />
          <Text style={s.thanksText}>Gracias por mejorar TrichAI</Text>
        </View>
      </View>
    );
  }

  if (state === 'correcting') {
    return (
      <View style={s.wrap}>
        <Text style={s.question}>¿Qué era realmente?</Text>
        <View style={s.chipGrid}>
          {VALID.map(key => {
            const lbl = LABELS[key];
            const isPrediction = key === result.label;
            return (
              <TouchableOpacity
                key={key}
                disabled={submitting || isPrediction}
                onPress={() => send(false, key)}
                style={[s.chip, isPrediction && s.chipDisabled]}
              >
                <Text style={[s.chipText, isPrediction && s.chipTextDisabled]}>
                  {lbl.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => setState('idle')} disabled={submitting} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={s.question}>¿Te ha sido útil este resultado?</Text>
      <View style={s.btnRow}>
        <TouchableOpacity style={s.ghostBtn} onPress={() => send(true)} disabled={submitting}>
          <Text style={s.ghostBtnText}>Sí, correcto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostBtn} onPress={() => setState('correcting')} disabled={submitting}>
          <Text style={s.ghostBtnTextMuted}>No, era otra cosa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: palette.border },
  question:   { color: palette.muted, fontSize: 13, marginBottom: 12, letterSpacing: -0.1 },
  btnRow:     { flexDirection: 'row', gap: 8 },
  ghostBtn:   {
    flex: 1, paddingVertical: 11,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: palette.border, borderRadius: 10,
    alignItems: 'center',
  },
  ghostBtnText:       { color: palette.text, fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },
  ghostBtnTextMuted:  { color: palette.muted, fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip:       {
    width: '49%', paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: palette.border, borderRadius: 8,
    alignItems: 'center',
  },
  chipDisabled: { opacity: 0.4 },
  chipText:   { color: palette.text, fontSize: 13, fontWeight: '500' },
  chipTextDisabled: { color: palette.dim },

  cancelBtn:  { paddingVertical: 6, alignItems: 'center' },
  cancelText: { color: palette.dim, fontSize: 12 },

  thanks:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  thanksText: { color: palette.muted, fontSize: 13, letterSpacing: -0.1 },
});
