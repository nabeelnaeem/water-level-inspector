import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig } from '@/context/ConfigContext';
import { AppConfig, DEFAULT_CONFIG } from '@/constants/appConfig';
import { api } from '@/api/client';
import { TankState } from '@/api/types';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { config, saveConfig } = useConfig();

  const [backendUrl, setBackendUrl] = useState(config.backendUrl);
  const [refreshSec, setRefreshSec] = useState(String(config.refreshInterval / 1000));
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<TestState>('idle');
  const [tanks, setTanks] = useState<TankState[]>([]);

  // Re-sync local fields when stored config loads.
  useEffect(() => {
    setBackendUrl(config.backendUrl);
    setRefreshSec(String(config.refreshInterval / 1000));
  }, [config.backendUrl, config.refreshInterval]);

  const buildConfig = (): AppConfig | null => {
    const sec = parseFloat(refreshSec);
    if (!backendUrl.startsWith('http')) return null;
    if (isNaN(sec) || sec < 5) return null;
    return { backendUrl: backendUrl.trim().replace(/\/+$/, ''), refreshInterval: sec * 1000 };
  };

  const handleSave = async () => {
    const next = buildConfig();
    if (!next) {
      Alert.alert(
        'Invalid values',
        '• Backend URL must start with http://\n• Refresh interval must be ≥ 5 seconds',
      );
      return;
    }
    await saveConfig(next);
    setSaved(true);
  };

  const handleTest = async () => {
    setTest('testing');
    setTanks([]);
    try {
      await api.health(backendUrl);
      const t = await api.listTanks(backendUrl);
      setTanks(t);
      setTest('ok');
    } catch {
      setTest('fail');
    }
  };

  const handleReset = () => {
    Alert.alert('Reset to defaults', 'Restore the default backend URL and refresh interval?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await saveConfig(DEFAULT_CONFIG);
          setBackendUrl(DEFAULT_CONFIG.backendUrl);
          setRefreshSec(String(DEFAULT_CONFIG.refreshInterval / 1000));
          setSaved(false);
          setTest('idle');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#060E18' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Settings</Text>
              <Text style={styles.headerSub}>Backend Connection</Text>
            </View>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} accessibilityLabel="Reset to defaults">
              <Ionicons name="refresh-circle-outline" size={20} color="#5A7A99" />
            </TouchableOpacity>
          </View>

          {/* Connection */}
          <SectionHeader title="Connection" color="#38BDF8" icon="server-outline" />
          <View style={styles.card}>
            <Field
              label="Backend URL"
              value={backendUrl}
              onChangeText={(v) => { setBackendUrl(v); setSaved(false); }}
              placeholder="http://192.168.1.50:4000"
              keyboard="url"
              mono
              hint="LAN address of the self-hosted backend."
            />
            <Field
              label="Refresh Interval (seconds)"
              value={refreshSec}
              onChangeText={(v) => { setRefreshSec(v); setSaved(false); }}
              placeholder="30"
              keyboard="decimal-pad"
              hint="Polling fallback; live updates arrive over WebSocket. Min 5s."
              last
            />
          </View>

          {/* Test connection */}
          <TouchableOpacity style={styles.testBtn} onPress={handleTest}>
            <Ionicons
              name={
                test === 'ok' ? 'checkmark-circle' : test === 'fail' ? 'close-circle' : 'pulse-outline'
              }
              size={18}
              color={test === 'ok' ? '#00D4AA' : test === 'fail' ? '#FF4444' : '#8AAEC8'}
            />
            <Text style={styles.testBtnText}>
              {test === 'testing'
                ? 'Testing…'
                : test === 'ok'
                ? `Connected · ${tanks.length} tank(s)`
                : test === 'fail'
                ? 'Connection failed'
                : 'Test connection'}
            </Text>
          </TouchableOpacity>

          {/* Discovered tanks (read-only) */}
          {test === 'ok' && (
            <>
              <SectionHeader title="Discovered Tanks" color="#A78BFA" icon="water" />
              <View style={styles.card}>
                {tanks.length === 0 ? (
                  <Text style={styles.emptyText}>No tanks configured on the backend yet.</Text>
                ) : (
                  tanks.map((t, i) => (
                    <View key={t.config.id} style={[styles.tankRow, i < tanks.length - 1 && styles.tankRowSep]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tankLabel}>{t.config.label}</Text>
                        <Text style={styles.tankMeta}>
                          {t.config.id} · {t.config.heightCm}cm · offset {t.config.maxLevelDistanceCm}cm
                        </Text>
                      </View>
                      <Text style={[styles.tankStatus, { color: t.status === 'ok' ? '#00D4AA' : t.status === 'fault' ? '#FF8C00' : '#FF4444' }]}>
                        {t.status}
                      </Text>
                    </View>
                  ))
                )}
              </View>
              <Text style={styles.footerNote}>
                Tank calibration (height, offset, capacity) is managed in the web dashboard.
              </Text>
            </>
          )}

          {/* Save */}
          <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave}>
            <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={20} color={saved ? '#00D4AA' : '#E2F0FF'} />
            <Text style={[styles.saveBtnText, saved && { color: '#00D4AA' }]}>
              {saved ? 'Saved!' : 'Save Changes'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function SectionHeader({ title, color, icon }: { title: string; color: string; icon: any }) {
  return (
    <View style={sectionStyles.header}>
      <View style={[sectionStyles.iconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[sectionStyles.title, { color }]}>{title}</Text>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboard?: any;
  hint?: string;
  mono?: boolean;
  last?: boolean;
}

function Field({ label, value, onChangeText, placeholder, keyboard, hint, mono, last }: FieldProps) {
  return (
    <View style={[fieldStyles.wrapper, !last && fieldStyles.separator]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, mono && fieldStyles.mono]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#2A4A68"
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus
      />
      {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});

const fieldStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  separator: { borderBottomWidth: 1, borderBottomColor: '#1A3048' },
  label: { fontSize: 12, fontWeight: '600', color: '#4A6A88', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    fontSize: 15,
    color: '#C0D8F0',
    backgroundColor: '#0A1828',
    borderWidth: 1,
    borderColor: '#1A3048',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 13 },
  hint: { fontSize: 11, color: '#2A4A68', marginTop: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060E18' },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#E2F0FF', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#4A6A88', fontWeight: '500', marginTop: 2 },
  resetBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0D1E2E',
    borderWidth: 1,
    borderColor: '#1A3048',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: '#0D1E2E', borderRadius: 16, borderWidth: 1, borderColor: '#1A3048', overflow: 'hidden' },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D1E2E',
    borderWidth: 1,
    borderColor: '#1A3048',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
  },
  testBtnText: { color: '#C0D8F0', fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#4A6A88', fontSize: 13, padding: 16 },
  tankRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  tankRowSep: { borderBottomWidth: 1, borderBottomColor: '#1A3048' },
  tankLabel: { color: '#C0D8F0', fontSize: 14, fontWeight: '600' },
  tankMeta: { color: '#4A6A88', fontSize: 11, marginTop: 2 },
  tankStatus: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D2A40',
    borderWidth: 1.5,
    borderColor: '#1A4A70',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
  },
  saveBtnDone: { backgroundColor: '#00D4AA10', borderColor: '#00D4AA40' },
  saveBtnText: { color: '#E2F0FF', fontSize: 16, fontWeight: '700' },
  footerNote: { color: '#2A4A68', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
