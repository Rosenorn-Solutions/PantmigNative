import { Redirect, useRouter } from "expo-router";
import React from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import PressableButton from "../components/PressableButton";
import StatsPreview, { StatsData } from "../components/StatsPreview";
import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";
import { createStatisticsApi } from './services/api';
import { useNotifications } from './services/notificationsStore';

export default function Index() {
  const router = useRouter();
  const { token, user, loading, logout } = useAuth();
  const { show } = useToast();

  const [statsLoading, setStatsLoading] = React.useState(true);
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const { unreadCount } = useNotifications();

  // Load statistics from backend for current user role (only when authenticated)
  React.useEffect(() => {
    let cancelled = false;
    if (!token) {
      // Not authenticated: ensure no background fetch happens and reset stats UI state
      setStats(null);
      setStatsLoading(false);
      return () => { cancelled = true; };
    }
    const load = async () => {
      try {
        setStatsLoading(true);
        const api = createStatisticsApi();
        let nextStats: StatsData;
        if (user?.role === 'Recycler') {
          const res = await api.statisticsRecycler();
          const totalListings = res.listingCount ?? 0;
          // Interpret listingCount as completed pickups for recycler dashboard
          const completedPickups = res.listingCount ?? 0;
          let bottles = 0;
          if (Array.isArray(res.breakdown)) {
            bottles = res.breakdown.reduce((sum, b) => sum + (b.quantity ?? 0), 0);
          } else if (typeof res.totalItems === 'number') {
            bottles = res.totalItems;
          }
          nextStats = { totalListings, completedPickups, bottlesRecycled: bottles };
        } else {
          // Default to donor stats when role is Donator or unknown
          const res = await api.statisticsDonor();
          const totalListings = res.listingCount ?? 0;
          // We don't have explicit completed pickups for donors; show listingCount as a proxy
          const completedPickups = res.listingCount ?? 0;
          const bottles = res.totalItems ?? 0;
          nextStats = { totalListings, completedPickups, bottlesRecycled: bottles };
        }
        if (!cancelled) setStats(nextStats);
      } catch (e) {
        // Soft-fail: keep zeros and notify once; details logged for debug
        // eslint-disable-next-line no-console
        console.warn('Failed to load statistics', e);
        if (!cancelled) setStats({ totalListings: 0, completedPickups: 0, bottlesRecycled: 0 });
        show('Kunne ikke hente statistik. Prøv igen senere.', 'error', 2500);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, user?.id, user?.role, show]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.page, Platform.OS === 'web' ? styles.pageWeb : null]} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroAccent} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Image source={require('../assets/images/logo-dark.png')} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
          <Text style={styles.hello}>Hej {user?.firstName}</Text>
        </View>
        <View style={{ marginTop: 4, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[styles.subtitle, { textAlign: 'center', fontWeight: '600' }]}>Tak for at være med til at vi alle får pantet mere ❤️</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 4 }]}>Kom hurtigt i gang nedenfor.</Text>
        </View>
      </View>

      <View style={[styles.contentGrid, Platform.OS === 'web' ? styles.contentGridWeb : null]}>
        {/* Quick actions */}
        <View style={[styles.card, Platform.OS === 'web' ? { flex: 1, minWidth: 360 } : null]}>
          <Text style={styles.sectionTitle}>Hurtige handlinger</Text>
      {/* Additional user context (role/city) can be surfaced here if needed */}
        <View style={{ gap: 8 }}>
          <PressableButton title={unreadCount ? `Notifikationer (${unreadCount})` : 'Notifikationer'} onPress={() => router.push('./notifications')} color="#2563eb" iconName="bell" style={styles.button} />
          {user?.role === 'Recycler' && (
            <>
              <PressableButton title="Se tilgængelige opslag" onPress={() => router.push("./listings")} color="#16a34a" iconName="list" style={styles.button} />
              <PressableButton title="Mine ansøgninger" onPress={() => router.push("./my-applications")} color="#6b7280" iconName="clipboard" style={styles.button} />
            </>
          )}
          {user?.role === 'Donator' && (
            <>
              <PressableButton title="Opret opslag" onPress={() => router.push("./create-listing")} color="#16a34a" iconName="file-circle-plus" style={styles.button} />
              <PressableButton title="Mine opslag" onPress={() => router.push("./my-listings")} color="#6b7280" iconName="folder-open" style={styles.button} />
            </>
          )}
          {/* Place settings just above logout to be second-lowest */}
          <PressableButton title="Brugerindstillinger" onPress={() => router.push('./settings')} color="#374151" iconName="gear" style={styles.button} />
        </View>
        <PressableButton title="Log ud" color="#dc2626" onPress={async () => { await logout(); show('Du er nu logget ud', 'success'); }} iconName="arrow-right-from-bracket" style={{ ...styles.button, marginTop: 8 }} />
        </View>

        {/* Stats preview */}
        <View style={[styles.card, Platform.OS === 'web' ? { flex: 1, minWidth: 360 } : null]}>
          <Text style={styles.sectionTitle}>Status og nøgletal</Text>
          <View style={{ width: '100%' }}>
            <StatsPreview loading={statsLoading} stats={stats} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    maxWidth: '100%',
    alignSelf: 'center',
    width: '100%',
  },
  pageWeb: {
    maxWidth: 900,
  },
  hero: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1fae5', // light green accent
    borderRadius: 10,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
  },
  heroAccent: {
    position: 'absolute',
    top: -16,
    right: -16,
    width: 72,
    height: 72,
    backgroundColor: '#ecfdf5',
    borderRadius: 9999,
    opacity: 0.6,
  },
  hello: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#475569',
  },
  contentGrid: {
    gap: 16,
    // On web mimic two columns by stacking cards side by side using row direction
    flexDirection: 'column',
  },
  contentGridWeb: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  // Web-only card width hint applied via inline style when Platform.OS === 'web'
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 16,
    flex: 1,
    overflow: 'hidden',
  },
  button: {
    justifyContent: 'center',
  }
 });
