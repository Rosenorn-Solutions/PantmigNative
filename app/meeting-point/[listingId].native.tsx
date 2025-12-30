import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { createRecycleListingsApi } from '../services/api';
// Using direct Photon geocoding (no shared service)
// Reverted to direct geocoding fetch (Photon). Simple local config:
const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

type MeetingPin = { latitude: number; longitude: number };

interface SearchBarProps {
  readonly query: string;
  readonly setQuery: (t: string) => void;
  readonly onSearch: () => void;
  readonly searching: boolean;
  readonly canEdit: boolean;
}

function SearchBar(props: SearchBarProps) {
  const { query, setQuery, onSearch, searching, canEdit } = props;
  return (
    <View style={{ flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' }}>
      <TextInput
        placeholder="Søg adresse eller sted (Danmark)"
        value={query}
        onChangeText={setQuery}
        style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 }}
        editable={canEdit}
      />
      <PressableButton
        title={searching ? 'Søger…' : 'Søg'}
        onPress={onSearch}
        disabled={!canEdit || searching || query.trim().length < MIN_CHARS}
        color="#6b7280"
        iconName="magnifying-glass-location"
      />
    </View>
  );
}

function Footer({ pin, canEdit, onSave, saving }: { readonly pin: MeetingPin | null; readonly canEdit: boolean; readonly onSave: () => void; readonly saving: boolean }) {
  return (
    <View style={{ padding: 12, borderTopWidth: 1, borderColor: '#eee', backgroundColor: 'white' }}>
      <Text style={{ marginBottom: 8 }}>Tryk på kortet for at vælge et mødested.</Text>
      {pin ? (
        <Text style={{ marginBottom: 8, fontSize: 12, color: '#555' }}>
          {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </Text>
      ) : null}
      {canEdit ? (
        <PressableButton
          title={saving ? 'Gemmer…' : 'Gem mødested'}
          onPress={onSave}
          disabled={!pin || saving}
          color="#10b981"
          iconName="save"
        />
      ) : null}
    </View>
  );
}

interface SuggestionsListProps {
  readonly suggestions: Array<{ display: string; lat: number; lon: number }>;
  readonly canEdit: boolean;
  readonly onPick: (lat: number, lon: number, display: string) => void;
}

function SuggestionsList(props: SuggestionsListProps) {
  const { suggestions, canEdit, onPick } = props;
  if (!canEdit || suggestions.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
      {suggestions.map((s, idx) => (
        <Text
          key={`${s.lat},${s.lon},${idx}`}
          onPress={() => onPick(s.lat, s.lon, s.display)}
          style={{ padding: 10, borderTopWidth: idx === 0 ? 0 : 1, borderColor: '#f0f0f0' }}
        >
          {s.display}
        </Text>
      ))}
    </View>
  );
}

function photonLabel(f: any): string {
  const p = f?.properties || {};
  const parts = [p.name, p.street, p.housenumber, p.city, p.country].filter(Boolean);
  return parts.join(', ');
}

export default function MeetingPointScreen() {
  const { listingId, readonly } = useLocalSearchParams<{ listingId: string; readonly?: string }>();
  const idNum = Number(listingId);
  const { token, user } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<MeetingPin | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; lat: number; lon: number }>>([]);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [region, setRegion] = useState<Region>({ latitude: 55.6761, longitude: 12.5683, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const pendingCenterRef = useRef<MeetingPin | null>(null);

  const load = useCallback(async () => {
    if (!token || !idNum) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const l = await api.listingsGetById({ id: idNum });
      if (l?.meetingPointLatitude != null && l?.meetingPointLongtitude != null) {
        setPin({ latitude: l.meetingPointLatitude, longitude: l.meetingPointLongtitude });
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente opslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, idNum]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!pin) return;
    // Update local region state (for UI/reference), but keep map uncontrolled for stability
    setRegion({ latitude: pin.latitude, longitude: pin.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    const animate = () => {
      const mv: any = mapRef.current as any;
      if (!mv) return;
      const r = { latitude: pin.latitude, longitude: pin.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      try { mv.animateToRegion(r, 650); } catch {}
      try { mv.animateCamera({ center: { latitude: pin.latitude, longitude: pin.longitude }, zoom: 15 }, { duration: 650 }); } catch {}
      try { mv.fitToCoordinates([{ latitude: pin.latitude, longitude: pin.longitude }], { edgePadding: { top: 64, right: 64, bottom: 64, left: 64 }, animated: true }); } catch {}
      try { mv.setCamera({ center: { latitude: pin.latitude, longitude: pin.longitude }, zoom: 15 }); } catch {}
    };
    if (mapReady) {
      animate();
    } else {
      pendingCenterRef.current = pin;
    }
  }, [pin?.latitude, pin?.longitude, mapReady]);

  const canEdit = user?.role === 'Donator' && readonly !== '1';

  const handleChangeQuery = useCallback((t: string) => {
    setSuggestionsEnabled(true);
    setQuery(t);
  }, []);

  const searchPlace = async () => {
    const q = query.trim();
      if (!q || q.length < MIN_CHARS || !canEdit) return;
    try {
      setSearching(true);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const feat = json?.features?.[0];
        const coords = feat?.geometry?.coordinates;
        if (Array.isArray(coords)) {
          const [lon, lat] = coords as [number, number];
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setPin({ latitude: lat, longitude: lon });
            // Close and suppress suggestions until the user types again
            setSuggestions([]);
            setSuggestionsEnabled(false);
          } else {
            show('Ingen resultater', 'error');
          }
        } else {
          show('Ingen resultater', 'error');
        }
    } catch (e) {
      console.error(e);
      show('Søgning fejlede', 'error');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!canEdit) { setSuggestions([]); return; }
    if (!suggestionsEnabled) { setSuggestions([]); return; }
    const q = query.trim();
      const h = setTimeout(async () => {
        if (q.length < MIN_CHARS) { setSuggestions([]); return; }
        try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          const json = await res.json();
          const feats = Array.isArray(json?.features) ? json.features : [];
          const mapped = feats
            .map((f: any) => {
              const coords = f?.geometry?.coordinates;
              const [lon, lat] = Array.isArray(coords) ? (coords as [number, number]) : [Number.NaN, Number.NaN];
              return { display: photonLabel(f), lat, lon };
            })
            .filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
          setSuggestions(mapped);
        } catch {
          setSuggestions([]);
        }
      }, DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query, canEdit, suggestionsEnabled]);

  

  const save = async () => {
    if (!pin) return;
    try {
      setSaving(true);
      const api = createRecycleListingsApi();
      await api.listingsMeetingSet({ meetingPointRequest: { listingId: idNum, latitude: pin.latitude, longitude: pin.longitude } });
      show('Mødested gemt', 'success');
      router.back();
    } catch (e) {
      console.error(e);
      show('Kunne ikke gemme mødested', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <Redirect href="/login" />;
  if (!idNum) return <SafeAreaView><Text>Mangler listingId</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Henter opslag…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <SearchBar query={query} setQuery={handleChangeQuery} onSearch={searchPlace} searching={searching} canEdit={canEdit} />
          <SuggestionsList
            suggestions={suggestions}
            canEdit={canEdit}
            onPick={(lat, lon, display) => {
              setQuery(display);
              setSuggestions([]);
              setSuggestionsEnabled(false);
              setPin({ latitude: lat, longitude: lon });
            }}
          />
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={pin ? { latitude: pin.latitude, longitude: pin.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 } : region}
            onMapReady={() => {
              setMapReady(true);
              // If a pin was set before the map was ready, animate now
              const p = pendingCenterRef.current;
              if (p && mapRef.current) {
                const mv: any = mapRef.current as any;
                const r = { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
                try { mv.animateToRegion(r, 650); } catch {}
                try { mv.animateCamera({ center: { latitude: p.latitude, longitude: p.longitude }, zoom: 15 }, { duration: 650 }); } catch {}
                try { mv.fitToCoordinates([{ latitude: p.latitude, longitude: p.longitude }], { edgePadding: { top: 64, right: 64, bottom: 64, left: 64 }, animated: true }); } catch {}
                try { mv.setCamera({ center: { latitude: p.latitude, longitude: p.longitude }, zoom: 15 }); } catch {}
                pendingCenterRef.current = null;
              }
            }}
            onPress={(e) => {
              if (!canEdit) return;
              const { coordinate } = e.nativeEvent;
              if (coordinate) setPin({ latitude: coordinate.latitude, longitude: coordinate.longitude });
            }}
            onRegionChangeComplete={(r) => setRegion(r)}
          >
            {pin && (
              <Marker
                coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
                draggable={canEdit}
                onDragEnd={(e) => {
                  const { coordinate } = e.nativeEvent;
                  if (coordinate) setPin({ latitude: coordinate.latitude, longitude: coordinate.longitude });
                }}
              />
            )}
          </MapView>
          <Footer pin={pin} canEdit={canEdit} onSave={save} saving={saving} />
        </View>
      )}
    </SafeAreaView>
  );
}
