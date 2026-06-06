import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { TankStatus } from '@/api/types';

interface Props {
  label: string;
  percentage: number;
  status: TankStatus;
  /** Adjusted distance from sensor in cm, or null when not OK. */
  distanceCm: number | null;
  accentColor: string;
  height?: number;
  width?: number;
}

function getLevelColor(pct: number): string {
  if (pct <= 15) return '#FF4444';
  if (pct <= 35) return '#FF8C00';
  return '#00D4AA';
}

function statusText(status: TankStatus): string {
  switch (status) {
    case 'ok':
      return 'Live';
    case 'fault':
      return 'Fault';
    case 'offline':
      return 'Offline';
  }
}

export default function TankGauge({
  label,
  percentage,
  status,
  distanceCm,
  accentColor,
  height = 240,
  width = 130,
}: Props) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  const isOk = status === 'ok';
  const isDown = status === 'offline' || status === 'fault';
  const pct = isOk ? percentage : 0;
  const fillColor =
    status === 'offline' ? '#444' : status === 'fault' ? '#FF8C00' : getLevelColor(pct);

  // Animate fill level change
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct / 100,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  // Continuous wave shimmer
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();
  }, []);

  // Pulse when offline or faulted
  useEffect(() => {
    if (isDown) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isDown]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height - 24], // leave room for rounded top cap
  });

  // Subtle wave ripple on the top surface
  const waveDx = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 4, 0],
  });

  return (
    <Animated.View style={[styles.wrapper, { opacity: isDown ? pulseAnim : 1 }]}>
      {/* Label */}
      <Text style={[styles.label, { color: accentColor }]}>{label}</Text>

      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: status === 'offline' ? '#FF444430' : `${fillColor}25` }]}>
        <View style={[styles.dot, { backgroundColor: status === 'offline' ? '#FF4444' : fillColor }]} />
        <Text style={[styles.badgeText, { color: status === 'offline' ? '#FF4444' : fillColor }]}>
          {statusText(status)}
        </Text>
      </View>

      {/* Tank body */}
      <View style={[styles.tank, { height, width }]}>
        {/* Tick marks */}
        {[25, 50, 75].map((tick) => (
          <View key={tick} style={[styles.tickRow, { bottom: (tick / 100) * (height - 24) }]}>
            <View style={styles.tickLine} />
            <Text style={styles.tickLabel}>{tick}%</Text>
          </View>
        ))}

        {/* Water fill */}
        <Animated.View
          style={[
            styles.fill,
            {
              height: fillHeight,
              backgroundColor: fillColor,
            },
          ]}
        >
          {/* Shimmer highlight */}
          <Animated.View style={[styles.shimmer, { transform: [{ translateX: waveDx }] }]} />
        </Animated.View>
      </View>

      {/* Percentage */}
      <Text style={[styles.pctText, { color: status === 'offline' ? '#666' : fillColor }]}>
        {isOk ? `${percentage.toFixed(1)}%` : '--.--%'}
      </Text>

      {/* Distance */}
      {isOk && distanceCm != null && (
        <Text style={styles.distText}>
          {distanceCm.toFixed(1)} cm from top
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  tank: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2A3A4A',
    backgroundColor: '#0D1620',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  fill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: '10%',
    width: '30%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 40,
  },
  tickRow: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
    gap: 3,
  },
  tickLine: {
    width: 10,
    height: 1,
    backgroundColor: '#2A3A4A',
  },
  tickLabel: {
    color: '#3A5068',
    fontSize: 9,
    fontWeight: '600',
  },
  pctText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  distText: {
    fontSize: 12,
    color: '#5A7A99',
    fontWeight: '500',
  },
});
