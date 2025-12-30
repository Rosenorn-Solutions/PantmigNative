import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import CompletedToggle from '../../components/CompletedToggle';
import PressableButton from '../../components/PressableButton';
import { ListingStatus } from '../apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from '../apis/pantmig-api/models/RecycleListing';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { createRecycleListingsApi } from '../services/api';
import { isFinalListing as isFinalListingHelper } from '../utils/listings';
import { getListingStatusView } from '../utils/status';
import { colors, radii } from '../utils/theme';

export default function MyListingsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [chatBusy, setChatBusy] = useState<number | null>(null);
  const [confirmBusy, setConfirmBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<RecycleListing | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<RecycleListing | null>(null);

  const isFinalListing = useCallback((l: RecycleListing) => isFinalListingHelper(l), []);

  // Memoized filtered data MUST be declared at top-level (not inside conditional JSX) to avoid hook order changes
  const visibleData = useMemo(() => {
    if (showCompleted) return data;
    return data.filter(l => !isFinalListing(l));
  }, [data, showCompleted, isFinalListing]);
  const hiddenCount = useMemo(() => data.reduce((acc, l) => acc + (isFinalListing(l) ? 1 : 0), 0), [data, isFinalListing]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const items = await api.listingsMy();
      const sorted = [...(items || [])].sort((a, b) => {
        // Non-final first, then final; within each group sort by createdAt desc
        const fa = isFinalListing(a) ? 1 : 0;
        const fb = isFinalListing(b) ? 1 : 0;
        if (fa !== fb) return fa - fb;
        const ca = (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const cb = (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return cb - ca;
      });
      setData(sorted);
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente dine opslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!token) return <Redirect href="/login" />;
  if (user?.role !== 'Donator') return <Redirect href="/" />;

  const cancelListing = async (listing: RecycleListing) => {
    try {
      setBusy(listing.id || null);
      const api = createRecycleListingsApi();
      await api.listingsCancel({ cancelRequest: { listingId: listing.id } });
      show('Opslag annulleret', 'success');
      await load();
    } catch (e) {
      console.error(e);
      show('Kunne ikke annullere opslag', 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmCancel = (listing: RecycleListing) => {
    if (!listing.id) return;
    setCancelTarget(listing);
  };
  const closeCancelModal = () => setCancelTarget(null);

  const openChat = async (listing: RecycleListing) => {
    if (!listing.id) return;
    try {
      setChatBusy(listing.id);
      // If no chat session exists, start it
      if (!listing.chatSessionId) {
        const api = createRecycleListingsApi();
        await api.listingsChatStart({ chatStartRequest: { listingId: listing.id } });
        show('Chat startet', 'success');
        // Reload to fetch chatSessionId
        await load();
      }
      router.push({ pathname: '/chat/[listingId]', params: { listingId: String(listing.id) } } as any);
    } catch (e) {
      console.error(e);
      show('Kunne ikke starte chat', 'error');
    } finally {
      setChatBusy(null);
    }
  };

  const confirmPickup = (listing: RecycleListing) => {
    if (!listing.id) return;
    setConfirmTarget(listing);
  };

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          data={visibleData}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Ingen opslag at vise.</Text>}
          // eslint-disable-next-line sonarjs/cognitive-complexity
          renderItem={({ item }) => {
            const isFinal = isFinalListing(item);
            const hasAssigned = !!item.assignedRecyclerUserId;
            // Show 'Færdiggør' when listing is accepted (status 2) and not already pickup-confirmed
            const canConfirmPickup = !isFinal && item.status === ListingStatus.NUMBER_2 && !!item.assignedRecyclerUserId && !item.pickupConfirmedAt;
            let chatTitle = 'Chat';
            if (isFinal) chatTitle = 'Chat (afsluttet)';
            if (chatBusy === item.id) chatTitle = 'Åbner…';
            // use file-scope formatDate/formatTime
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, borderRadius: radii.card, backgroundColor: isFinal ? colors.cardFinalBg : colors.cardBg }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
                <View style={{ marginTop: 6, gap: 2 }}>
                  <Text style={{ color: '#374151' }}>
                    Antal: {(item.items || [])?.reduce((sum: number, it: any) => sum + (it?.quantity || 0), 0)}
                  </Text>
                  {(item.availableFrom || item.availableTo) ? (
                    <Text style={{ color: '#374151' }}>
                      Tilgængelig: {formatDate(item.availableFrom)}{item.availableTo ? ` – ${formatDate(item.availableTo)}` : ''}
                    </Text>
                  ) : null}
                  {/* Pickup time removed */}
                  <MaterialTypeCheckmarks items={item.items as any[] | null | undefined} />
                </View>
                <Text style={{ marginTop: 4, color: getListingStatusView(item).color }}>
                  Status: {getListingStatusView(item).label}
                </Text>
                {isFinal ? <Text style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>Afsluttet</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {hasAssigned ? null : (
                    <PressableButton
                      title="Se ansøgere"
                      disabled={isFinal || hasAssigned}
                      onPress={() => {
                        if (isFinal || hasAssigned) return;
                        router.push({ pathname: '/listing-applicants', params: { id: String(item.id) } } as any);
                      }}
                      color="#6b7280"
                      iconName="user-group"
                    />
                  )}
                  {item.assignedRecyclerUserId ? (
                    <PressableButton
                      title={chatTitle}
                      onPress={() => openChat(item)}
                      disabled={chatBusy === item.id || isFinal}
                      color="#2563eb"
                      iconName="comments"
                    />
                  ) : null}
                  {item.chatSessionId ? (
                    <PressableButton
                      title={(((item as any).meetingPointLatitude ?? (item as any).meetingLatitude) != null && ((item as any).meetingPointLongtitude ?? (item as any).meetingLongitude) != null) ? 'Mødested' : 'Sæt mødested'}
                      disabled={isFinal}
                      onPress={() => router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(item.id), readonly: isFinal ? '1' : '0' } } as any)}
                      color="#050f96ff"
                      iconName="location-dot"
                    />
                  ) : null}
                  {canConfirmPickup ? (
                    <PressableButton
                      title={confirmBusy === item.id ? 'Bekræfter…' : 'Færdiggør'}
                      color="#16a34a" // green
                      onPress={() => confirmPickup(item)}
                      disabled={confirmBusy === item.id}
                      iconName="check"
                    />
                  ) : null}
                  {item.meetingSetAt ? null : (
                    <View style={{ marginLeft: 'auto' }}>
                      <PressableButton
                        title={busy === item.id ? 'Annullerer…' : 'Annullér'}
                        color="#dc2626"
                        onPress={() => confirmCancel(item)}
                        disabled={busy === item.id || isFinal}
                        iconName="circle-minus"
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
  <CompletedToggle placement="bottom-right" showCompleted={showCompleted} onToggle={() => setShowCompleted(s => !s)} hiddenCount={hiddenCount} />
      {cancelTarget ? (
        <View style={modalStyles.overlay}>
          <Pressable style={modalStyles.backdrop} onPress={closeCancelModal} />
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Annullér opslag</Text>
            <Text style={modalStyles.message}>
              Er du sikker på, at du vil annullere dette opslag? Dette kan ikke fortrydes.
            </Text>
            <View style={modalStyles.buttonsRow}>
              <PressableButton title="Tilbage" color="#6b7280" iconName="arrow-left" onPress={closeCancelModal} />
              <PressableButton
                title={busy === cancelTarget.id ? 'Annullerer…' : 'Ja, annullér'}
                color="#dc2626"
                iconName="circle-minus"
                onPress={() => { void cancelListing(cancelTarget); closeCancelModal(); }}
                disabled={busy === cancelTarget.id}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Confirm pickup modal */}
      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <View style={modalStyles.overlay}>
          <Pressable style={modalStyles.backdrop} onPress={() => setConfirmTarget(null)} />
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Bekræft afhentning</Text>
            <Text style={modalStyles.message}>
              Er du sikker på at pantet er afhentet? Dette afslutter opslaget.
            </Text>
            <View style={modalStyles.buttonsRow}>
              <PressableButton title="Tilbage" color="#6b7280" iconName="arrow-left" onPress={() => setConfirmTarget(null)} />
              <PressableButton
                title={confirmBusy === confirmTarget?.id ? 'Bekræfter…' : 'Ja, færdiggør'}
                color="#16a34a"
                iconName="check"
                onPress={() => {
                  if (!confirmTarget?.id) return;
                  (async () => {
                    try {
                      setConfirmBusy(confirmTarget.id!);
                      const api = createRecycleListingsApi();
                      await api.listingsPickupConfirm({ pickupConfirmRequest: { listingId: confirmTarget.id } });
                      show('Afhentning bekræftet – tak!', 'success');
                      await load();
                      setConfirmTarget(null);
                    } catch (e) {
                      console.error(e);
                      show('Kunne ikke bekræfte afhentning', 'error');
                    } finally {
                      setConfirmBusy(null);
                    }
                  })();
                }}
                disabled={confirmBusy === confirmTarget?.id}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
 

const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  card: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
    color: '#111827',
  },
  message: {
    color: '#374151',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
});
const formatDate = (d?: Date | string | null) => {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch { return ''; }
};
// Pickup times removed

type ItemLike = { materialType?: number | null } | null | undefined;
function MaterialTypeCheckmarks({ items }: Readonly<{ items?: ItemLike[] | null }>) {
  const list = items || [];
  const hasPlast = list.some(it => (it?.materialType as number | undefined) === 1);
  const hasGlas = list.some(it => (it?.materialType as number | undefined) === 2);
  const hasCan = list.some(it => (it?.materialType as number | undefined) === 3);
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{ color: '#374151' }}>Plastikflasker: {hasPlast ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Glasflasker: {hasGlas ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Dåser: {hasCan ? '✅' : '❌'}</Text>
    </View>
  );
}
