import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/apiService';
import ituApi from '../services/ituApi';
import obsApi from '../services/obsApi';
import { useObsStore } from './useObsStore';
import { useNinovaStore } from './useNinovaStore';

const CACHE_KEY = '@appStoreCache_v2';
const CACHEABLE_KEYS = ['announcements'];
const STATIC_ANNOUNCEMENTS_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/announcements.json';

const saveToCache = async (state) => {
    try {
        const toCache = {};
        CACHEABLE_KEYS.forEach(key => {
            if (state[key] !== undefined && state[key] !== null) {
                toCache[key] = state[key];
            }
        });
        toCache._cachedAt = Date.now();
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
    } catch (e) {
        console.error('[App Cache] ❌ Kaydetme hatası:', e);
    }
};

const loadFromCache = async () => {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return 0;
    const dotParts = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotParts) {
        return new Date(parseInt(dotParts[3]), parseInt(dotParts[2]) - 1, parseInt(dotParts[1])).getTime();
    }
    const months = {
        'ocak': 0, 'oca': 0, 'şubat': 1, 'şub': 1, 'mart': 2, 'mar': 2,
        'nisan': 3, 'nis': 3, 'mayıs': 4, 'may': 4, 'haziran': 5, 'haz': 5,
        'temmuz': 6, 'tem': 6, 'ağustos': 7, 'ağu': 7, 'eylül': 8, 'eyl': 8,
        'ekim': 9, 'eki': 9, 'kasım': 10, 'kas': 10, 'aralık': 11, 'ara': 11
    };
    const trParts = dateStr.toLowerCase().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
    if (trParts && months[trParts[2]] !== undefined) {
        return new Date(parseInt(trParts[3]), months[trParts[2]], parseInt(trParts[1])).getTime();
    }
    const ts = Date.parse(dateStr);
    return isNaN(ts) ? 0 : ts;
};

const parseAnnouncements = (data) => {
    if (!data) return [];
    let allItems = [];
    Object.values(data).forEach(source => {
        if (source.data && Array.isArray(source.data)) {
            source.data.forEach(item => {
                allItems.push({ ...item, sourceName: source.name, timestamp: parseDate(item.date) });
            });
        }
    });
    allItems.sort((a, b) => b.timestamp - a.timestamp);
    return allItems.slice(0, 5);
};

export const useAppStore = create((set, get) => ({
    announcements: [],
    widgetRefreshing: {},
    globalRefreshing: false,
    cacheLoaded: false,

    setUserData: () => {}, // Compatibility placeholder

    setWidgetRefreshing: (widgetId, isRefreshing) => set((state) => ({
        widgetRefreshing: { ...state.widgetRefreshing, [widgetId]: isRefreshing }
    })),

    loadCache: async () => {
        await Promise.all([
            useObsStore.getState().loadCache(),
            useNinovaStore.getState().loadCache()
        ]);

        const cached = await loadFromCache();
        if (cached) {
            const updates = {};
            CACHEABLE_KEYS.forEach(key => {
                if (cached[key] !== undefined) updates[key] = cached[key];
            });
            set({ ...updates, cacheLoaded: true });
        } else {
            set({ cacheLoaded: true });
        }
    },

    fetchInitialData: async () => {
        set({ globalRefreshing: true });

        // Ensure token is loaded in ituApi
        if (!ituApi.token) {
            await ituApi.loadStoredToken();
        }

        if (!ituApi.token) {
            set({ globalRefreshing: false });
            return;
        }

        // Trigger OBS store fetch
        await useObsStore.getState().fetchInitialData();
        await useObsStore.getState().fetchTermsAndCourses();

        // Trigger Ninova store fetch
        await useNinovaStore.getState().fetchInitialData();

        // Fetch announcements
        try {
            api.swr(STATIC_ANNOUNCEMENTS_URL, (data) => {
                if (data) set({ announcements: parseAnnouncements(data) });
            });
        } catch (e) {
            console.warn('[Zustand] Announcement API hatası:', e);
        }

        set({ globalRefreshing: false });
        saveToCache(get());
    },

    refreshWidget: async (widgetId) => {
        const { widgetRefreshing } = get();
        if (Object.values(widgetRefreshing).some(v => v)) return;

        get().setWidgetRefreshing(widgetId, true);

        try {
            if (widgetId === 'announcements') {
                const res = await api.get(STATIC_ANNOUNCEMENTS_URL, { skipCache: true });
                if (res) set({ announcements: parseAnnouncements(res) });
            } else if (widgetId === 'active_homeworks') {
                await useNinovaStore.getState().refreshWidget(widgetId);
            } else {
                await useObsStore.getState().refreshWidget(widgetId);
            }
        } catch (e) {
            console.error(`Widget yenileme hatası: ${widgetId}`, e);
        }

        get().setWidgetRefreshing(widgetId, false);
        saveToCache(get());
    },

    refreshAll: async () => {
        set({ globalRefreshing: true });

        try {

            obsApi.fetchPersonalInformation().then(data => {
                if (data && data.StatusCode === 0 && data.Bakiye) {
                    useObsStore.getState().setUserData({ balance: data.Bakiye, quota: data.Kota });
                }
            }).catch(() => {});

            await get().fetchInitialData();
        } catch (e) {
            console.error("Toplu yenileme hatası:", e);
        }

        set({ globalRefreshing: false });
    }
}));
