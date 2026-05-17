import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_DATA_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/notes.json';
const CACHE_KEY = 'static_notes_data';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 Saat (Notlar çok sık değişmez)

class NoteHelper {
    /**
     * Notlar içinde arama yapar
     * @param {string} query - Arama kelimesi (Ders kodu veya başlık)
     * @returns {Promise<Array>} Sonuç listesi
     */
    async searchNotes(query) {
        try {
            const allNotes = await this._loadData();
            if (!allNotes || !Array.isArray(allNotes)) return [];

            if (!query || query.length < 2) return [];

            // Türkçe karakter normalizasyonu ve büyük harfe çevirme
            const normalizedQuery = query
                .replace(/İ/g, 'I')
                .replace(/ı/g, 'I')
                .replace(/i/g, 'I')
                .toUpperCase();

            // Arama: Ders kodu veya başlık içinde geçiyor mu?
            return allNotes.filter(note => {
                const code = (note.courseCode || '').toUpperCase();
                const title = (note.title || '').toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/ı/g, 'I')
                    .replace(/i/g, 'I');

                return code.includes(normalizedQuery) || title.includes(normalizedQuery);
            });

        } catch (error) {
            console.error('[NoteHelper] Search error:', error);
            return [];
        }
    }

    /**
     * Veriyi fetch eder veya cache'den okur
     */
    async _loadData() {
        try {
            // Check Repository Cache First
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                // 24 saat geçmediyse cache'den dön
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    return data;
                }
            }

            // Fetch From GitHub
            const response = await fetch(NOTES_DATA_URL);
            if (!response.ok) throw new Error('Notes data fetch failed');
            
            const data = await response.json();
            
            // Save to Local Cache
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (e) {
            console.warn('[NoteHelper] Load failed:', e);
            const fallback = await AsyncStorage.getItem(CACHE_KEY);
            return fallback ? JSON.parse(fallback).data : null;
        }
    }
}

export default new NoteHelper();
