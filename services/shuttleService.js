/**
 * Shuttle Service - Global singleton for shuttle position tracking
 * 
 * - App başladığında 10 saniyede bir shuttle verisi çeker (arka plan)
 * - Ring ekranı açıldığında 2 saniyeye geçer
 * - Ring ekranı kapandığında 10 saniyeye döner
 */

const SHUTTLE_URL = 'https://harita.itu.edu.tr/Home/GetSuttlePosition';
const BACKGROUND_INTERVAL = 10000; // 10 saniye
const ACTIVE_INTERVAL = 2000;      // 2 saniye

let shuttles = [];
let lastUpdated = null;
let intervalId = null;
let listeners = new Set();
let isActive = false; // Ring ekranı açık mı?

const parseShuttles = (data) => {
    if (!data?.isSuccess || !Array.isArray(data.data)) return [];
    return data.data.filter(s => {
        if (s.TypeKey === 'staff') return false;
        try {
            const lat = parseFloat(String(s.Latitude).replace(',', '.'));
            const lon = parseFloat(String(s.Longitude).replace(',', '.'));
            return !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);
        } catch (e) { return false; }
    });
};

const fetchShuttles = async () => {
    try {
        const response = await fetch(SHUTTLE_URL, {
            method: 'POST',
            body: '',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.ok) {
            const data = await response.json();
            const valid = parseShuttles(data);
            if (valid.length > 0 || data?.isSuccess) {
                shuttles = valid;
                lastUpdated = new Date();
                // Notify all listeners
                listeners.forEach(fn => fn(shuttles, lastUpdated));
            }
        }
    } catch (error) {
        // Sessizce devam et
    }
};

const startPolling = (interval) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(fetchShuttles, interval);
};

// App başladığında çağrılır
const startBackgroundPolling = () => {
    fetchShuttles(); // Hemen bir kez çek
    startPolling(BACKGROUND_INTERVAL);
};

// Ring ekranı açıldığında çağrılır
const setActiveMode = () => {
    isActive = true;
    fetchShuttles(); // Hemen taze veri çek
    startPolling(ACTIVE_INTERVAL);
};

// Ring ekranından çıkıldığında çağrılır
const setBackgroundMode = () => {
    isActive = false;
    startPolling(BACKGROUND_INTERVAL);
};

// Listener ekle/kaldır (RingScreen state güncellemesi için)
const subscribe = (fn) => {
    listeners.add(fn);
    // Hemen mevcut veriyi gönder
    if (shuttles.length > 0) {
        fn(shuttles, lastUpdated);
    }
    return () => listeners.delete(fn);
};

const getShuttles = () => shuttles;
const getLastUpdated = () => lastUpdated;

export default {
    startBackgroundPolling,
    setActiveMode,
    setBackgroundMode,
    subscribe,
    getShuttles,
    getLastUpdated,
};
