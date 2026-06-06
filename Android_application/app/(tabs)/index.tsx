import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TankGauge from '@/components/TankGauge';
import HistorySparkline from '@/components/HistorySparkline';
import { useTanks } from '@/hooks/useTanks';
import { useConfig } from '@/context/ConfigContext';
import { api } from '@/api/client';
import { TankState } from '@/api/types';

const ACCENTS = ['#38BDF8', '#A78BFA', '#34D399', '#F472B6', '#FBBF24'];

function formatTime(date: Date | null): string {
  if (!date) return 'Never';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { config } = useConfig();
  const [data, refresh] = useTanks(config.backendUrl, config.refreshInterval);

  // Ask every node for a fresh reading, then re-pull the snapshot. The new
  // readings also stream in over the WebSocket within a few seconds.
  const onRefresh = useCallback(() => {
    data.tanks.forEach((t) =>
      api.refreshTank(config.backendUrl, t.config.id).catch(() => {}),
    );
    refresh();
  }, [data.tanks, config.backendUrl, refresh]);

  const sorted = [...data.tanks].sort((a, b) => a.config.sortOrder - b.config.sortOrder);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#060E18" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
            colors={['#00D4AA']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Water Level</Text>
            <Text style={styles.headerSub}>Home Tank Monitor</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, data.isRefreshing && styles.refreshBtnActive]}
            onPress={onRefresh}
            disabled={data.isRefreshing}
            accessibilityLabel="Refresh tank data"
          >
            <Ionicons
              name={data.isRefreshing ? 'sync' : 'refresh'}
              size={20}
              color={data.isRefreshing ? '#00D4AA' : '#8AAEC8'}
            />
          </TouchableOpacity>
        </View>

        {/* Status bar */}
        <View style={styles.updateBar}>
          <Ionicons name="time-outline" size={13} color="#3A5068" />
          <Text style={styles.updateText}>Updated: {formatTime(data.lastUpdated)}</Text>
          <View style={styles.updateBarRight}>
            <View
              style={[
                styles.autoRefreshDot,
                { backgroundColor: data.connected ? '#00D4AA' : '#FF8C00' },
              ]}
            />
            <Text style={styles.autoRefreshText}>{data.connected ? 'Live' : 'Reconnecting'}</Text>
          </View>
        </View>

        {/* Error banner */}
        {data.error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#FF4444" />
            <Text style={styles.errorText}>{data.error}</Text>
          </View>
        )}

        {/* Empty states */}
        {!data.error && !data.isLoading && sorted.length === 0 && (
          <View style={styles.errorBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#FF8C00" />
            <Text style={[styles.errorText, { color: '#FF8C00' }]}>
              No tanks configured. Add one in the web dashboard, then a node with a matching ID.
            </Text>
          </View>
        )}

        {/* Tanks */}
        {sorted.map((tank, i) => (
          <TankBlock key={tank.config.id} tank={tank} accent={ACCENTS[i % ACCENTS.length]} />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function TankBlock({ tank, accent }: { tank: TankState; accent: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const { config, latest, status } = tank;
  const ok = status === 'ok';
  const pct = ok && latest ? latest.percentage : 0;
  const dist = ok && latest ? latest.adjustedDistanceCm : null;
  const waterHeight = ok && latest ? latest.waterHeightCm : null;

  return (
    <View style={styles.tankBlock}>
      <View style={styles.gaugeRow}>
        <TankGauge
          label={config.label}
          percentage={pct}
          status={status}
          distanceCm={dist}
          accentColor={accent}
          height={240}
          width={150}
        />
      </View>

      <View style={[styles.detailCard, { borderTopColor: accent }]}>
        <DetailRow icon="water" color={accent} label="Water height"
          value={waterHeight != null ? `${waterHeight.toFixed(1)} cm` : 'N/A'} />
        <DetailRow icon="arrow-down" color="#5A7A99" label="Dist from top"
          value={dist != null ? `${dist.toFixed(1)} cm` : 'N/A'} />
        <DetailRow icon="resize-outline" color="#5A7A99" label="Tank height"
          value={`${config.heightCm} cm`} />
        {latest?.volumeLiters != null && ok && (
          <DetailRow icon="beaker-outline" color="#5A7A99" label="Volume"
            value={`${latest.volumeLiters} L`} />
        )}
        {latest?.rssi != null && ok && (
          <DetailRow icon="wifi" color="#5A7A99" label="Signal" value={`${latest.rssi} dBm`} />
        )}

        <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory((s) => !s)}>
          <Text style={[styles.historyToggleText, { color: accent }]}>
            {showHistory ? 'Hide history ▲' : 'Show history ▼'}
          </Text>
        </TouchableOpacity>

        {showHistory && (
          <View style={styles.historyWrap}>
            <HistorySparkline tankId={config.id} hours={24} accentColor={accent} />
          </View>
        )}
      </View>
    </View>
  );
}

function DetailRow({
  icon,
  color,
  label,
  value,
}: {
  icon: any;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.detailKey}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060E18' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#E2F0FF', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#4A6A88', fontWeight: '500', marginTop: 2 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0D1E2E',
    borderWidth: 1,
    borderColor: '#1A3048',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnActive: { borderColor: '#00D4AA40', backgroundColor: '#00D4AA10' },
  updateBar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  updateText: { fontSize: 12, color: '#3A5068', flex: 1 },
  updateBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  autoRefreshDot: { width: 5, height: 5, borderRadius: 2.5 },
  autoRefreshText: { fontSize: 11, color: '#3A5068' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF444415',
    borderWidth: 1,
    borderColor: '#FF444430',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { color: '#FF4444', fontSize: 13, flex: 1 },
  tankBlock: { marginBottom: 24 },
  gaugeRow: { alignItems: 'center', marginBottom: 16 },
  detailCard: {
    backgroundColor: '#0D1E2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A3048',
    borderTopWidth: 2,
    padding: 16,
    gap: 8,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailKey: { color: '#4A6A88', fontSize: 13, flex: 1 },
  detailValue: { color: '#C0D8F0', fontSize: 13, fontWeight: '600' },
  historyToggle: { marginTop: 6, paddingVertical: 6 },
  historyToggleText: { fontSize: 13, fontWeight: '700' },
  historyWrap: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1A3048',
    paddingTop: 14,
  },
});
