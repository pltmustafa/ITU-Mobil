/**
 * API Service — Merkezi HTTP istemcisi
 * Tüm fetch çağrılarını tek noktadan yönetir.
 * Timeout, hata yönetimi ve task polling içerir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';


const DEFAULT_TIMEOUT = 10000; // 10 saniye

class ApiService {
    /**
     * GET isteği (ETag Cache Destekli)
     * @param {string} path - Tam URL
     * @param {object} options - { timeout, skipCache }
     * @returns {Promise<any>} JSON response
     */
    constructor() {
        this.memoryCache = new Map();
    }


    /**
     * Cache'ten senkron veri okuma (State initialization için)
     */
    getCached(path) {
        return this.memoryCache.get(path) || null;
    }

    /**
     * GET isteği (ETag Cache Destekli)
     * @param {string} path - Tam URL
     * @param {object} options - { timeout, skipCache }
     * @returns {Promise<any>} JSON response
     */
    async get(path, options = {}) {
        const { skipCache = false, ...reqOptions } = options;
        const cacheKey = `api_cache_${path}`;
        let cached = null;

        if (!skipCache) {
            try {
                // Öncelik Memory Cache
                if (this.memoryCache.has(path)) {
                    cached = { data: this.memoryCache.get(path) };
                }

                const raw = await AsyncStorage.getItem(cacheKey);
                if (raw) {
                    const diskCached = JSON.parse(raw);
                    cached = diskCached;
                    // Diskten okuyunca memory'i de tazele (eğer boşsa)
                    if (!this.memoryCache.has(path)) {
                        this.memoryCache.set(path, diskCached.data);
                    }
                }
            } catch (e) {
                console.warn('Cache read error:', e);
            }
        }

        const headers = reqOptions.headers || {};
        if (cached?.etag) {
            headers['If-None-Match'] = cached.etag;
        }

        try {
            const res = await this._request(path, {
                method: 'GET',
                ...reqOptions,
                headers,
                _returnFullResponse: true // ETag kontrolü için full response istiyoruz
            });

            // 304 Not Modified -> Cache'den dön
            if (res.status === 304) {
                console.log(`[API] ✅ Veri zaten güncel (304): ${path}`);
                if (!this.memoryCache.has(path) && cached?.data) {
                    this.memoryCache.set(path, cached.data);
                }
                return cached.data;
            }

            // Yeni veri geldi -> Cache güncelle
            const { data, headers: resHeaders } = res;

            // Cloudflare/Brotli bazen ETag'i silebilir, X-ETag yedeğine bak
            const newEtag = resHeaders.get('x-etag') || resHeaders.get('etag');

            if (newEtag && !skipCache) {
                console.log(`[API] 🔄 Veri güncellendi (200): ${path}`);
                // Memory Cache Update
                this.memoryCache.set(path, data);

                // Disk Cache Update
                AsyncStorage.setItem(cacheKey, JSON.stringify({
                    etag: newEtag,
                    data: data,
                    updatedAt: Date.now()
                })).catch(e => console.warn('Cache write error:', e));
            } else if (!skipCache) {
                console.log(`[API] Veri alındı (No ETag): ${path}`);
            }

            // ETag yoksa bile memory cache'e atalım (anlık hız için)
            if (!newEtag && !skipCache) {
                this.memoryCache.set(path, data);
            }

            return data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * POST isteği
     * @param {string} path - Endpoint yolu
     * @param {object} body - Request body (opsiyonel)
     * @param {object} options - { timeout }
     * @returns {Promise<any>} JSON response
     */
    async post(path, body = null, options = {}) {
        const fetchOptions = { method: 'POST' };
        if (body) {
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify(body);
        }
        return this._request(path, { ...fetchOptions, ...options });
    }


    /**
     * Stale-While-Revalidate (SWR) Pattern
     * Önce cache'deki veriyi anında döner, sonra arkaplanda güncel veriyi çeker.
     * @param {string} path - Endpoint yolu
     * @param {function} callback - Veri geldiğinde çalışacak fonksiyon (data, isCached)
     * @param {object} options - { timeout }
     */
    async swr(path, callback, options = {}) {
        const cacheKey = `api_cache_${path}`;

        // 0. Memory Cache (Senkron ve en hızlı)
        const memData = this.memoryCache.get(path);
        if (memData) {
            // console.log(`[SWR] Memory Cache HIT for: ${path}`);
            callback(memData, true);
        }

        // 1. Disk Cache (AsyncStorage)
        // Eğer memory'de yoksa diskten oku
        if (!memData) {
            try {
                // console.log(`[SWR] Checking disk cache for: ${path}`);
                const raw = await AsyncStorage.getItem(cacheKey);
                if (raw) {
                    const cached = JSON.parse(raw);
                    if (cached.data) {
                        // console.log(`[SWR] Disk Cache HIT for: ${path}`);
                        this.memoryCache.set(path, cached.data); // Memory'e taşı
                        callback(cached.data, true);
                    }
                }
            } catch (e) {
                console.warn('[SWR] Cache read error:', e);
            }
        }

        // 2. Network'ten güncel veriyi çek (ETag sayesinde değişmediyse 304 döner)
        try {
            // console.log(`[Background Sync] Checking update for: ${path}...`);
            const data = await this.get(path, options);

            // Eğer get() başarılı olduysa, en güncel veri budur.
            // ...

            callback(data, false);

        } catch (error) {
            console.warn(`[Background Sync] Update FAILED for ${path}:`, error);
        }
    }

    /**
     * Uygulama güncellendirme kontrolü yapar
     * @param {string} version - Mevcut uygulama versiyonu
     * @returns {Promise<object>} { hasUpdate, latestVersion, changelog }
     */
    async checkUpdate(version) {
        try {
            const response = await fetch('https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp/refs/heads/main/package.json');
            const remotePackage = await response.json();
            const latestVersion = remotePackage.version;
            const changelog = remotePackage.changelog || "Yeni bir güncelleme mevcut! GitHub üzerinden en son sürümü indirebilirsiniz.";

            // latestVersion'ın mevcut versiyondan büyük olup olmadığını kontrol et
            const isUpdateAvailable = latestVersion.localeCompare(version, undefined, { numeric: true, sensitivity: 'base' }) > 0;

            return {
                hasUpdate: isUpdateAvailable,
                latestVersion: latestVersion,
                changelog: changelog
            };
        } catch (error) {
            console.warn('[API] Versiyon kontrolü başarısız:', error.message);
            return { hasUpdate: false };
        }
    }

    // ── Internal ──

    async _request(path, options = {}) {
        const { timeout = DEFAULT_TIMEOUT, _returnFullResponse = false, ...fetchOptions } = options;
        const url = path;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });

            // 304 Not Modified kontrolü
            if (response.status === 304) {
                if (_returnFullResponse) {
                    return { status: 304 };
                }
                // Normal kullanımda get() içinde cache handle edilmeli, buraya düşmez.
                // Ama düşerse null dönelim.
                return null;
            }

            if (!response.ok) {
                throw new ApiError(
                    `HTTP ${response.status}`,
                    response.status,
                    path
                );
            }

            const data = await response.json();

            if (_returnFullResponse) {
                return {
                    data,
                    headers: response.headers,
                    status: response.status
                };
            }

            return data;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            if (error.name === 'AbortError') {
                throw new ApiError('İstek zaman aşımına uğradı', 0, path);
            }
            throw new ApiError(
                'Sunucuya bağlanılamadı',
                0,
                path,
                error
            );
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export class ApiError extends Error {
    constructor(message, statusCode = 0, path = '', originalError = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.path = path;
        this.originalError = originalError;
    }

    get isTimeout() {
        return this.message === 'İstek zaman aşımına uğradı';
    }

    get isNetworkError() {
        return this.statusCode === 0 && !this.isTimeout;
    }
}

// Singleton export
const api = new ApiService();
export default api;
