import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, Text, TextInput, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import type { RecycleListing } from '../apis/pantmig-api/models/RecycleListing';
import { API_BASE } from '../config';
import { authApi, createRecycleListingsApi } from '../services/api';
import { getManyUsersFromCache, getMissingIds, mergeBatchIntoCache, setManyUsersInCache } from '../services/userCache';

interface ChatMessage {
  id: string; // local generated for rendering
  from?: string | null;
  text: string;
  at: Date;
  system?: boolean;
}

function MessageBubble({ item, mine, otherRole }: { readonly item: ChatMessage; readonly mine: boolean; readonly otherRole?: 'Donor'|'Panter' }) {
  let bg = '#2563eb';
  if (!mine) {
    bg = otherRole === 'Donor' ? '#d1fae5' : '#e5e7eb';
  }
  const bubbleStyle = { backgroundColor: bg, padding: 8, borderRadius: 8 } as const;
  const timeStr = item.at.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={{ marginBottom: 8, width: '100%' }}>
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: 720, width: 'auto' }}>
        <View style={bubbleStyle}>
        <Text style={{ color: mine ? 'white' : '#111' }}>{item.text}</Text>
        <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.85)' : '#555', marginTop: 4 }}>{timeStr}</Text>
        </View>
      </View>
    </View>
  );
}

function SystemMessage({ text }: { readonly text: string }) {
  return <View style={{ marginBottom: 8, alignSelf: 'center', maxWidth: '80%' }}><Text style={{ fontSize: 12, color: '#666' }}>{text}</Text></View>;
}

function NameHeader({ name, roleTag, mine }: { readonly name: string; readonly roleTag: string; readonly mine: boolean }) {
  return (
    <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.9)' : '#444', marginBottom: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      {name}{roleTag}
    </Text>
  );
}

export default function ListingChatScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const numericId = Number(listingId);
  const { token, user } = useAuth();
  const { show } = useToast();
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [listing, setListing] = useState<RecycleListing | null>(null);
  const [userInfo, setUserInfo] = useState<Record<string, { userName?: string; rating?: number }>>({});
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const getSenderId = (obj: any): string | null => {
    return (
      obj?.fromUserId ?? obj?.senderUserId ?? obj?.senderId ?? obj?.userId ?? obj?.UserId ?? obj?.authorId ?? obj?.AuthorId ?? obj?.from ?? obj?.user ?? null
    );
  };

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const appendMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).slice(2) }]);
    scrollToBottom();
  };

  // Build hub URL (ensure base path without trailing slash)
  const hubUrl = `${(API_BASE || process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:5001').replace(/\/$/, '')}/hubs/chat`;

  useEffect(() => {
    if (!token || !numericId) return;
    const loadListing = async () => {
      try {
        const api = createRecycleListingsApi();
        const l = await api.listingsGetById({ id: numericId });
        setListing(l);
      } catch (e) {
        console.error(e);
      }
    };
    loadListing();

    const connect = async () => {
      setConnecting(true);
      setConnectionError(null);
      try {
        const connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrl, { accessTokenFactory: () => token })
          .withAutomaticReconnect()
          .configureLogging(signalR.LogLevel.Information)
          .build();

        connection.on('Joined', (payload: any) => {
          if (Array.isArray(payload?.history)) {
            const historyArr: ChatMessage[] = [];
            for (const h of payload.history) {
              const from = getSenderId(h);
              historyArr.push({
                id: Math.random().toString(36).slice(2),
                from,
                text: h.text,
                at: new Date(h.at || h.sentAt || Date.now()),
              });
            }
            setMessages(historyArr);
            scrollToBottom();
          }
          appendMessage({ system: true, text: 'Du er tilsluttet chatten', at: new Date(), from: null });
        });

        connection.on('ReceiveMessage', (msg: any) => {
          const from = getSenderId(msg);
          appendMessage({ from, text: msg.text, at: new Date(msg.at || msg.sentAt || Date.now()) });
        });

        connection.onreconnecting(() => {
          appendMessage({ system: true, text: 'Forbinder igen...', at: new Date(), from: null });
        });
        connection.onreconnected(() => {
          appendMessage({ system: true, text: 'Forbundet igen', at: new Date(), from: null });
        });
        connection.onclose(() => {
          appendMessage({ system: true, text: 'Forbindelsen lukket', at: new Date(), from: null });
        });

        await connection.start();
        await connection.invoke('JoinListingChat', numericId);

        connectionRef.current = connection;
      } catch (err: any) {
        console.error('SignalR connection error', err);
        setConnectionError('Kunne ikke forbinde til chatten');
      } finally {
        setConnecting(false);
      }
    };

    connect();

    return () => {
      const c = connectionRef.current;
      if (c) {
        c.invoke('LeaveListingChat', numericId).catch(() => {});
        c.stop();
      }
    };
  }, [token, numericId]);

  // Participant user info loading (donator + recycler + senders from messages)
  useEffect(() => {
    const run = async () => {
      if (!token) return;
      const collectIds = (): string[] => {
        const set = new Set<string>();
        if (listing?.createdByUserId) set.add(listing.createdByUserId);
        if (listing?.assignedRecyclerUserId) set.add(listing.assignedRecyclerUserId);
        for (const m of messages) if (m.from) set.add(m.from);
        return Array.from(set);
      };
      const idArr = collectIds();
      if (!idArr.length) return;
      const cached = getManyUsersFromCache(idArr);
      if (Object.keys(cached).length) setUserInfo(prev => ({ ...prev, ...cached }));
      const missing = getMissingIds(idArr, { userName: true });
      if (!missing.length) return;
      try {
        const batch = await authApi.authUsersLookup({ usersLookupRequest: { ids: missing } });
        mergeBatchIntoCache(batch?.users);
        if (!batch?.users) return;
        const updates: Record<string, { userName?: string; rating?: number }> = {};
        for (const u of batch.users) {
          if (!u?.id) continue;
          updates[u.id] = { userName: (u as any).userName, rating: (u as any).rating };
        }
        if (Object.keys(updates).length) {
          setUserInfo(prev => ({ ...prev, ...updates }));
          setManyUsersInCache(updates);
        }
      } catch (e) {
        console.warn('Kunne ikke hente brugernavne', e);
      }
    };
    run();
  }, [token, listing, messages]);

  const send = useCallback(async () => {
    if (!connectionRef.current || !input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      await connectionRef.current.invoke('SendMessage', numericId, text);
      // Clear persisted draft for this listing
      AsyncStorage.removeItem(`chatDraft:${numericId}`).catch(() => {});
    } catch (e) {
      console.error(e);
      show('Kunne ikke sende besked', 'error');
      setInput(text); // restore
    }
  }, [input, numericId, user?.id]);

  // Persist draft when input changes (debounced minimal)
  useEffect(() => {
    const key = `chatDraft:${numericId}`;
    const id = setTimeout(() => {
      if (input) AsyncStorage.setItem(key, input).catch(() => {}); else AsyncStorage.removeItem(key).catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [input, numericId]);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!numericId) return;
      try {
        const val = await AsyncStorage.getItem(`chatDraft:${numericId}`);
        if (val) setInput(val);
      } catch {}
    };
    loadDraft();
  }, [numericId]);

  if (!token) return <Redirect href="/login" />;
  if (!numericId) return <SafeAreaView><Text>Mangler listingId</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, width: '100%', alignSelf: 'center', maxWidth: 900, paddingHorizontal: 12 }}>
        {(() => {
          if (connecting) {
            return (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8 }}>Forbinder til chat…</Text>
              </View>
            );
          }
          if (connectionError) {
            return (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <Text style={{ color: 'red', marginBottom: 12 }}>{connectionError}</Text>
                <PressableButton title="Prøv igen" onPress={() => {
                  const c = connectionRef.current; if (c) { c.stop(); }
                  connectionRef.current = null;
                  setConnecting(true); // effect will reconnect
                }} color="#2563eb" iconName="rotate-right" />
              </View>
            );
          }
          return (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => {
                const normalize = (v?: string | null) => (v ?? '').toString().toLowerCase();
                const mine = !!item.from && normalize(item.from) === normalize(user?.id ?? '');
                if (item.system) return <SystemMessage text={item.text} />;
                const cached = item.from ? userInfo[item.from]?.userName : undefined;
                let name = '';
                if (cached) name = cached;
                else if (mine) name = 'Mig';
                else if (item.from) name = item.from.slice(0, 6);
                let roleTag = '';
                let otherRole: 'Donor' | 'Panter' | undefined;
                if (item.from && listing) {
                  if (normalize(item.from) === normalize(listing.createdByUserId || '')) { roleTag = ' · Donor'; otherRole = 'Donor'; }
                  else if (normalize(item.from) === normalize(listing.assignedRecyclerUserId || '')) { roleTag = ' · Panter'; otherRole = 'Panter'; }
                }
                return (
                  <View style={{ marginBottom: 8, width: '100%' }}>
                    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: 720, width: 'auto' }}>
                      <NameHeader name={name} roleTag={roleTag} mine={mine} />
                      <MessageBubble item={item} mine={mine} otherRole={otherRole} />
                    </View>
                  </View>
                );
              }}
            />
          );
        })()}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
          <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: 'white' }}>
            <TextInput
              placeholder="Skriv en besked"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              style={{ flex: 1, padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginRight: 8 }}
              editable={!connecting && !connectionError}
            />
            <PressableButton title="Send" onPress={send} disabled={!input.trim() || connecting || !!connectionError} color="#16a34a" iconName="arrow-right" />
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
