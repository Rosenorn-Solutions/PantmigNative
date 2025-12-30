import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TextInput, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { createRecycleListingsApi } from '../services/api';
// Using direct Photon geocoding (no shared service)
const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

function photonLabel(f: any): string {
  const p = f?.properties || {};
  const parts = [p.name, p.street, p.housenumber, p.city, p.country].filter(Boolean);
  return parts.join(', ');
}

type MeetingPin = { latitude: number; longitude: number };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RL = require('react-leaflet');
const { MapContainer, TileLayer, CircleMarker, useMapEvent } = RL;
// Inject Leaflet CSS via CDN to avoid Metro CSS import limitations on web
// Load Leaflet CSS on web at runtime

function MapClicker({ canEdit, onPick }: { canEdit: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvent('click', (e: any) => {
    if (!canEdit) return;
    const { lat, lng } = e?.latlng || {};
    if (typeof lat === 'number' && typeof lng === 'number') onPick(lat, lng);
  });
  return null;
}

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
  const r = useRouter();
  return (
    <View style={{ padding: 12, borderTopWidth: 1, borderColor: '#eee', backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' }}>
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
          style={{ maxWidth: 200, marginBottom: 8 }}
        />
      ) : null}
      <PressableButton
        title="Fortryd"
        onPress={() => r.back()}
        color="#dc2626"
        iconName="arrow-left"
      />
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

export default function MeetingPointScreen() {
  // Inject Leaflet CSS once on mount
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => {
      try { link.remove(); } catch {}
    };
  }, []);
  const { listingId, readonly } = useLocalSearchParams<{ listingId: string; readonly?: string }>();
  const idNum = Number(listingId);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const { token, user } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; lat: number; lon: number }>>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<MeetingPin | null>(null);
  const region = pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : { latitude: 55.6761, longitude: 12.5683, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const [webMapKey, setWebMapKey] = useState(0);
  const [webCenter, setWebCenter] = useState<[number, number]>([region.latitude, region.longitude]);

  const load = useCallback(async () => {
    if (!token || !idNum) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const l = await api.listingsGetById({ id: idNum });
      // Backend now returns meeting point coordinates on the listing response
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
    if (pin) { setWebCenter([pin.latitude, pin.longitude]); setWebMapKey((k) => k + 1); }
  }, [pin?.latitude, pin?.longitude]);

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
          setWebCenter([lat, lon]);
          setWebMapKey((k) => k + 1);
          // Close and suppress suggestions until user types again
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
        <View style={{ flex: 1, width: '100%', alignSelf: 'center', maxWidth: 900 }}>
          <SearchBar query={query} setQuery={handleChangeQuery} onSearch={searchPlace} searching={searching} canEdit={canEdit} />
          <SuggestionsList
            suggestions={suggestions}
            canEdit={canEdit}
            onPick={(lat, lon, display) => {
              setQuery(display);
              setSuggestions([]);
              setPin({ latitude: lat, longitude: lon });
              setSuggestionsEnabled(false);
              setWebCenter([lat, lon]);
              setWebMapKey((k) => k + 1);
            }}
          />
          <View style={{ flex: 1, minHeight: 300 }}>
            <MapContainer
              key={webMapKey}
              center={webCenter || [pin?.latitude ?? region.latitude, pin?.longitude ?? region.longitude]}
              zoom={14}
              className="mapFill"
              style={{ height: '100%', width: '100%', cursor: canEdit ? 'crosshair' : 'default' }}
              dragging={!canEdit}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap-bidragydere" />
              <MapClicker canEdit={canEdit} onPick={(lat, lng) => setPin({ latitude: lat, longitude: lng })} />
              {pin ? (
                <CircleMarker center={[pin.latitude, pin.longitude]} radius={10} pathOptions={{ color: '#2563eb' }} />
              ) : null}
            </MapContainer>
          </View>
          <Footer pin={pin} canEdit={canEdit} onSave={save} saving={saving} />
        </View>
      )}
    </SafeAreaView>
  );
}