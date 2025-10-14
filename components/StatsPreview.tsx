import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';

const BRAND_TINT = '#ecfdf5'; // light green tint
const BRAND_ICON = '#065f46'; // dark green for icons/text accents

export type StatsData = {
  totalListings: number;
  completedPickups: number;
  bottlesRecycled: number;
};

export function StatsPreview({ loading, stats }: Readonly<{ loading?: boolean; stats?: StatsData | null }>) {
  if (loading) {
    return (
      <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 12, flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap', width: '100%', alignItems: 'stretch' }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 12, flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap', width: '100%', alignItems: 'stretch' }}>
      <Kpi title="Opslag i alt" value={stats?.totalListings ?? 0} icon="list" tint={BRAND_TINT} />
      <Kpi title="Afhentninger afsluttet" value={stats?.completedPickups ?? 0} icon="check-circle" tint={BRAND_TINT} />
      <Kpi title="Flasker genanvendt" value={stats?.bottlesRecycled ?? 0} icon="recycle" tint={BRAND_TINT} />
    </View>
  );
}

function Kpi({ title, value, icon, tint }: Readonly<{ title: string; value: number | string; icon?: any; tint?: string }>) {
  return (
    <View style={{ flexGrow: 1, minWidth: 220, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, backgroundColor: tint || '#ffffff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <FontAwesome6 name={icon} size={16} color={BRAND_ICON} /> : null}
        <Text style={{ color: BRAND_ICON, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', marginTop: 6, color: '#064e3b' }}>{formatNumber(value)}</Text>
    </View>
  );
}

function SkeletonCard() {
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const bg = pulse.interpolate({ inputRange: [0, 1], outputRange: ['#f1f5f9', '#e5e7eb'] });
  return (
    <Animated.View style={{ flexGrow: 1, minWidth: 220, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, backgroundColor: bg }}>
      <View style={{ height: 12, width: '50%', backgroundColor: '#cbd5e1', borderRadius: 6 }} />
      <View style={{ height: 28, width: '40%', backgroundColor: '#cbd5e1', borderRadius: 6, marginTop: 10 }} />
    </Animated.View>
  );
}

function formatNumber(n: number | string) {
  if (typeof n === 'string') return n;
  try {
    return new Intl.NumberFormat('da-DK').format(n);
  } catch {
    return String(n);
  }
}

export default StatsPreview;
