import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOMS_DATA_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/rooms.json';
const CACHE_KEY = 'static_rooms_data';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 Saat

class RoomHelper {
    /**
     * Boş sınıfları hesaplar
     * @param {string} buildingCode - Bina kodu (örn: MED)
     * @returns {Promise<object>} { full_day, limited }
     */
    async getEmptyRooms(buildingCode) {
        try {
            const allCourses = await this._loadData();
            if (!allCourses) return { full_day: [], limited: {} };

            // 1. O binadaki tüm dersleri filtrele
            const targetBuilding = buildingCode.toUpperCase();
            const buildingCourses = allCourses.filter(c => c.building === targetBuilding && c.room !== '--');

            if (buildingCourses.length === 0) return { full_day: [], limited: {} };

            // 2. Binadaki tüm benzersiz odaları bul
            const allRooms = [...new Set(buildingCourses.map(c => c.room))];

            // 3. Mevcut Zaman ve Gün bilgilerini al (TR Saat Dilimi)
            // Not: İTÜ uygulaması olduğu için cihazın TR vaktinde olduğunu varsayıyoruz. 
            // Değilse bile İTÜ öğrencisi TR vaktine göre işlem yapar.
            const now = new Date();
            const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
            const todayName = dayNames[now.getDay()];
            
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            const currentTimeVal = (currentHour * 60) + currentMin;

            const roomData = {}; // room -> { lessons: [[start, end], ...] }
            allRooms.forEach(r => roomData[r] = []);

            buildingCourses.forEach(c => {
                if (c.day !== todayName) return;
                const [startStr, endStr] = c.time.split('/');
                const [sH, sM] = startStr.split(':').map(Number);
                const [eH, eM] = endStr.split(':').map(Number);
                roomData[c.room].push([(sH * 60) + sM, (eH * 60) + eM]);
            });

            const full_day = [];
            const limited = {};
            const will_be_empty = {};

            const TWO_HOURS_MIN = 120; // Kullanıcı isteği: Maksimum 2 saat

            allRooms.forEach(room => {
                const lessons = roomData[room].sort((a, b) => a[0] - b[0]);
                
                // 1. Şu an ders var mı ölç (Current lesson index)
                let currentLessonIndex = lessons.findIndex(l => currentTimeVal >= l[0] && currentTimeVal <= l[1]);

                if (currentLessonIndex !== -1) {
                    // Şu an DOLU -> Ne zaman boşalacak?
                    // Ardışık dersleri birleştirerek gerçek boşalma vaktini bul
                    let freeAt = lessons[currentLessonIndex][1];
                    let nextIdx = currentLessonIndex + 1;
                    for (; nextIdx < lessons.length; nextIdx++) {
                        if (lessons[nextIdx][0] <= freeAt + 10) { // 10 dk mola payı
                            freeAt = lessons[nextIdx][1];
                        } else {
                            break;
                        }
                    }

                    // Eğer 2 saat içinde boşalıyorsa listeye ekle
                    if (freeAt > currentTimeVal && freeAt - currentTimeVal <= TWO_HOURS_MIN) {
                        const timeStr = this._formatTime(freeAt);
                        
                        // Ne kadar süre boş kalacak?
                        let durationStr = "Günün geri kalanı";
                        if (nextIdx < lessons.length) {
                             const roundedFreeAt = this._roundMinutes(freeAt);
                             const nextLessonStart = this._roundMinutes(lessons[nextIdx][0]);
                             const durationMin = nextLessonStart - roundedFreeAt;
                             const dH = Math.floor(durationMin / 60);
                             const dM = durationMin % 60;
                             durationStr = dH > 0 ? (dM > 0 ? `${dH}sa ${dM}dk` : `${dH}sa`) : `${dM}dk`;
                        }

                        if (!will_be_empty[timeStr]) will_be_empty[timeStr] = [];
                        will_be_empty[timeStr].push({ room, duration: durationStr });
                    }
                } else {
                    // Şu an BOŞ
                    // Bugün başka ders var mı?
                    let nextLesson = lessons.find(l => l[0] > currentTimeVal);
                    if (nextLesson) {
                        // Kısmi boş: Saat formatına geri çevir
                        const timeStr = this._formatTime(nextLesson[0]);
                        
                        if (!limited[timeStr]) limited[timeStr] = [];
                        limited[timeStr].push(room);
                    } else {
                        // Tam gün boş
                        full_day.push(room);
                    }
                }
            });

            return {
                full_day: full_day.sort(),
                limited: limited,
                will_be_empty: will_be_empty
            };

        } catch (error) {
            console.error('[RoomHelper] Error:', error);
            throw error;
        }
    }

    /**
     * Saat bilgisini formatlar ve kullanıcı isteğine göre 29/59 bitişlerini yuvarlar
     */
    _formatTime(minutes) {
        const rounded = this._roundMinutes(minutes);
        const h = Math.floor(rounded / 60);
        const m = rounded % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * 29 -> 30, 59 -> 00 yuvarlaması
     */
    _roundMinutes(minutes) {
        const m = minutes % 60;
        if (m === 29 || m === 59) return minutes + 1;
        return minutes;
    }

    /**
     * Veriyi fetch eder veya cache'den okur
     */
    async _loadData() {
        try {
            // Check Cache
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    return data;
                }
            }

            // Fetch New
            const response = await fetch(ROOMS_DATA_URL);
            if (!response.ok) throw new Error('Data fetch failed');
            
            const data = await response.json();
            
            // Save Cache
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (e) {
            console.warn('[RoomHelper] Load failed, falling back to cache if available:', e);
            const fallback = await AsyncStorage.getItem(CACHE_KEY);
            return fallback ? JSON.parse(fallback).data : null;
        }
    }
}

export default new RoomHelper();
