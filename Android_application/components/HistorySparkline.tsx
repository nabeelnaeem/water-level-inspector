import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useConfig } from '@/context/ConfigContext';
import { useHistory } from '@/hooks/useHistory';

interface Props {
  tankId: string;
  hours?: number;
  accentColor: string;
}

/**
 * Minimal dependency-free history view: vertical bars of percentage over time.
 * Avoids pulling a native charting library into the managed Expo app.
 */
export default function HistorySparkline({ tankId, hours = 24, accentColor }: Props) {
  const { config } = useConfig();
  const { points, loading } = useHistory(config.backendUrl, tankId, hours);

  if (loading) {
    return <Text style={styles.muted}>Loading history…</Text>;
  }
  if (points.length === 0) {
    return <Text style={styles.muted}>No history yet.</Text>;
  }

  // Show at most the last 48 points so bars stay legible on a phone.
  const shown = points.slice(-48);

  return (
    <View>
      <View style={styles.chart}>
        {shown.map((p, i) => {
          const h = p.fault ? 2 : Math.max(2, (p.percentage / 100) * 56);
          const color = p.fault ? '#FF8C00' : accentColor;
          return <View key={i} style={[styles.bar, { height: h, backgroundColor: color }]} />;
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{hours}h ago</Text>
        <Text style={styles.axisLabel}>now</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: {
    color: '#3A5068',
    fontSize: 10,
  },
  muted: {
    color: '#4A6A88',
    fontSize: 13,
    paddingVertical: 12,
  },
});
