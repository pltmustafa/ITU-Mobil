import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ituApi from './ituApi';
import obsApi from './obsApi';
import notificationApi from './notificationApi';

const BACKGROUND_FETCH_TASK = 'background-obs-grades-fetch';
const GRADE_CACHE_PREFIX = 'obs_grades_';
const LETTER_CACHE_PREFIX = 'obs_letters_';
const NOTIFICATION_CACHE_KEY = 'general_notifications_cache';

// Güncel dönemi bulmak için obsApi içerisindeki yöntem
const getCurrentDonemKodu = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (month >= 9) return `${year + 1}10`;
    if (month <= 1) return `${year}10`;
    if (month >= 2 && month <= 6) return `${year}20`;
    return `${year}30`;
};

const findCurrentTerm = (donemList) => {
    const code = getCurrentDonemKodu();
    const match = donemList.find(d => d.donemKodu === code);
    if (match) return match;
    const sorted = [...donemList].sort((a, b) => parseInt(b.donemKodu) - parseInt(a.donemKodu));
    return sorted[0];
};

export async function executeGradeCheckTask() {
    try {
        console.log('[BackgroundTask] Arkaplan not kontrolü başlatıldı.');

        // 1. Session Load
        await ituApi.loadStoredToken();
        if (!ituApi.token || !ituApi.userInfo?.studentId || !ituApi.userInfo?.keplerToken) {
            console.log('[BackgroundTask] Kullanıcı girişi yapılamadı, durduruluyor.');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        let hasNewUpdates = false;

        // --- 1.5. Genel Bildirimler (İTÜ Bildirimleri) Kontrolü ---
        try {
            const freshNotifications = await notificationApi.getNotifications(0);
            if (freshNotifications && freshNotifications.length > 0) {
                const cachedNotifsRaw = await AsyncStorage.getItem(NOTIFICATION_CACHE_KEY);
                const cachedNotifs = cachedNotifsRaw ? JSON.parse(cachedNotifsRaw) : [];

                const getNotifId = (n) => n.NotificationId || n.Id || n.Url || (n.Title + n.CreateDate);
                const cachedIdentifiers = cachedNotifs.map(getNotifId);

                const newlyAnnouncedNotifs = freshNotifications.filter(n => {
                    return !cachedIdentifiers.includes(getNotifId(n));
                });

                if (newlyAnnouncedNotifs.length > 0) {
                    hasNewUpdates = true;
                    // Eğer cache boşsa (ilk kez çalışıyorsa), geçmiş bildirimleri teker teker atarak spame sebep olma
                    if (cachedNotifs.length > 0) {
                        for (const ann of newlyAnnouncedNotifs) {
                            await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: ann.Title || 'Yeni İTÜ Bildirimi',
                                    body: ann.SummaryText || 'Detaylar için uygulamayı açın.',
                                    sound: true,
                                },
                                trigger: null,
                            });
                        }
                    }
                    await AsyncStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(freshNotifications));
                }
            }
        } catch (e) {
            console.error(`[BackgroundTask] Genel bildirimler okunurken hata:`, e);
        }

        // 2. Fetch Active Term
        const donemlerRes = await obsApi.fetchKepler('DonemListesi');

        if (!donemlerRes?.ogrenciDonemListesi?.length) {
            return hasNewUpdates ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const activeTerm = findCurrentTerm(donemlerRes.ogrenciDonemListesi);
        if (!activeTerm) {
            return hasNewUpdates ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // 3. Fetch Classes for Active Term
        const classesRes = await obsApi.fetchKepler(`sinif/KayitliSinifListesi/${activeTerm.akademikDonemId}`);
        if (!classesRes?.kayitSinifResultList) {
            return hasNewUpdates ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Derslerin CRN ve isim eşleşmelerini saklayalım (Harf notu isim çevirisi için)
        const classMap = {};
        classesRes.kayitSinifResultList.forEach(c => {
            classMap[c.crn] = `${c.bransKodu} ${c.dersKodu}`;
        });

        // 4. Harf Notları (Letter Grades) Kontrolü
        try {
            const lettersRes = await obsApi.fetchKepler(`sinif/SinifHarfNotuListesi/${activeTerm.akademikDonemId}`);
            if (lettersRes?.sinifHarfNotuResultList) {
                const freshLetters = lettersRes.sinifHarfNotuResultList;
                const cachedLettersRaw = await AsyncStorage.getItem(LETTER_CACHE_PREFIX + activeTerm.akademikDonemId);
                const cachedLetters = cachedLettersRaw ? JSON.parse(cachedLettersRaw) : [];

                const newlyAnnouncedLetters = freshLetters.filter(f => {
                    // Geçerli bir harf notu yoksa (null, boş string vs.) atla
                    if (!f.harfNotu || f.harfNotu.trim() === '') return false;

                    const cItem = cachedLetters.find(old => old.crn === f.crn);

                    // Önceden bu CRN yoksa veya harfNotu boşken dolduysa
                    if (!cItem) return true;
                    if ((!cItem.harfNotu || cItem.harfNotu.trim() === '') && f.harfNotu.trim() !== '') return true;

                    return false;
                });

                for (const ann of newlyAnnouncedLetters) {
                    hasNewUpdates = true;
                    const cName = classMap[ann.crn] || `Ders (CRN: ${ann.crn})`;
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Harf Notu Açıklandı',
                            body: `${cName}: ${ann.harfNotu}`,
                            sound: true,
                        },
                        trigger: null,
                    });
                }

                await AsyncStorage.setItem(LETTER_CACHE_PREFIX + activeTerm.akademikDonemId, JSON.stringify(freshLetters));
            }
        } catch (e) {
            console.error(`[BackgroundTask] Harf notu listesi okunurken hata:`, e);
        }

        // 5. Dönem İçi Notlar (Ara Sınav, Ödev, Final) Kontrolü
        for (const c of classesRes.kayitSinifResultList) {
            const sid = c.sinifId || c.dersSinifId || c.SinifId || c.DersSinifId;
            const courseCode = `${c.bransKodu} ${c.dersKodu}`;

            try {
                // Yeni Notları Çek
                const freshData = await obsApi.fetchKepler(`sinif/SinifDonemIciNotListesi/${sid}`);
                if (!freshData || !freshData.ogrenciNotGrupListesi) continue;

                // Cache'i kontrol et
                const cachedRaw = await AsyncStorage.getItem(GRADE_CACHE_PREFIX + sid);

                if (cachedRaw) {
                    const cachedData = JSON.parse(cachedRaw);

                    const flatFresh = freshData.ogrenciNotGrupListesi.flatMap(g => g.ogrenciNotListesi || []);
                    const flatCached = cachedData.ogrenciNotGrupListesi
                        ? cachedData.ogrenciNotGrupListesi.flatMap(g => g.ogrenciNotListesi || [])
                        : [];

                    // Yeni ilan edilenleri ayıkla
                    const newlyAnnounced = flatFresh.filter(f => {
                        // Eğer 'not' kısmı henüz boşsa veya sistem ilan etmediyse atla
                        if (!f.ilanEdilmeDurumu || f.not === null || f.not === undefined) return false;

                        const cItem = flatCached.find(oldItem => oldItem.kisaAciklama === f.kisaAciklama);

                        // Eski elemanda yoksa yeni açıklanmıştır
                        if (!cItem) return true;

                        // Eski elemanın notu yok ama yeni elemanın varsa
                        if (cItem.not === null && f.not !== null) return true;

                        // Eski elemanda ilan durumu false iken, şimdi true olduysa
                        if (!cItem.ilanEdilmeDurumu && f.ilanEdilmeDurumu) return true;

                        return false;
                    });

                    // Bildirim Fırlat
                    for (const ann of newlyAnnounced) {
                        hasNewUpdates = true;
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Yeni Not Açıklandı',
                                body: `${courseCode} ${ann.kisaAciklama}: ${ann.not}`,
                                sound: true,
                            },
                            trigger: null,
                        });
                    }
                }

                // Veriyi Güvenlice Cache'e Yaz
                await AsyncStorage.setItem(GRADE_CACHE_PREFIX + sid, JSON.stringify(freshData));

            } catch (e) {
                console.error(`[BackgroundTask] ${sid} dersi okunurken hata:`, e);
            }
        }

        if (hasNewUpdates) {
            console.log('[BackgroundTask] Yeni not bulundu ve bildirim atıldı.');
            return BackgroundFetch.BackgroundFetchResult.NewData;
        } else {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

    } catch (error) {
        console.error('[BackgroundTask] Görev hatası:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, executeGradeCheckTask);

export async function registerBackgroundFetchAsync() {
    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes minimum check
        stopOnTerminate: false,
        startOnBoot: true,
    });
}

export async function unregisterBackgroundFetchAsync() {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
