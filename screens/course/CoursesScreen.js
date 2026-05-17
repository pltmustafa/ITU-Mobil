import { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ScrollView, ActivityIndicator, RefreshControl, Platform, StatusBar,
    Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import obsApi from '../../services/obsApi';
import { useToast } from '../../components/common/Toast';

const CACHE_KEY_TERMS = 'obs_terms_cache_v3';
const GRADE_CACHE_PREFIX = 'obs_grades_';

// _raw alanlarını temizle (cache'e yazılabilir hale getir)
const stripRawForCache = (termsArr) => {
    return termsArr.map(t => ({
        ...t,
        courses: t.courses?.map(c => {
            const { _raw, ...rest } = c;
            return rest;
        })
    }));
};

const fetchClassesAndGrades = async (termId) => {
    try {
        const [classRes, harfRes] = await Promise.allSettled([
            obsApi.fetchKepler(`sinif/KayitliSinifListesi/${termId}`),
            obsApi.fetchKepler(`sinif/SinifHarfNotuListesi/${termId}`)
        ]);

        const harfMap = {};
        if (harfRes.status === 'fulfilled' && harfRes.value?.sinifHarfNotuResultList) {
            harfRes.value.sinifHarfNotuResultList.forEach(h => {
                harfMap[h.crn] = h.harfNotu;
            });
        }

        if (classRes.status === 'fulfilled' && classRes.value?.kayitSinifResultList) {
            return classRes.value.kayitSinifResultList.map(c => ({
                sinifId: c.sinifId,
                crn: c.crn,
                name: `${c.bransKodu} ${c.dersKodu} - ${c.dersAdiTR}`,
                harfNotu: harfMap[c.crn] || null,
                _raw: c
            }));
        }
    } catch (e) {
        console.warn('fetchClassesAndGrades hatası:', e);
    }
    return null;
};

export default function CoursesScreen({ navigation }) {
    const [terms, setTerms] = useState([]);
    const [selectedTermIndex, setSelectedTermIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showTermPicker, setShowTermPicker] = useState(false);
    const [prefetchedGrades, setPrefetchedGrades] = useState({}); // { sinifId: gradeData }
    const { showToast, ToastComponent } = useToast();

    // Seçili dönemin dersleri
    const selectedTerm = terms[selectedTermIndex] || null;
    const courses = selectedTerm?.courses || [];
    const isCurrentTerm = selectedTermIndex === 0;

    // ─── Mount: Cache → API (sadece güncel dönem) → Paralel not prefetch ───
    useEffect(() => {
        const init = async () => {
            // 1. Cache'den yükle → anında UI
            let cachedTerms = null;
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY_TERMS);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed?.length > 0) {
                        cachedTerms = parsed;
                        setTerms(parsed);
                        setSelectedTermIndex(0);
                        setLoading(false);
                        console.log('[Courses] Cache\'den yüklendi:', parsed.length, 'dönem');
                    }
                }
            } catch (e) {
                console.warn('[Courses] Cache okuma hatası:', e);
            }

            // 2. API'den dönem + güncel dönemin derslerini çek
            await fetchCurrentTermFromApi(cachedTerms);
        };
        init();
    }, []);

    /**
     * Sadece güncel dönemi API'den çeker. Eski dönemler zaten cache'de.
     * Eğer cache yoksa, tüm dönem listesini çeker.
     */
    const fetchCurrentTermFromApi = async (cachedTerms = null) => {
        const silent = !!cachedTerms;
        if (!silent) setLoading(true);

        try {
            // Dönem listesini çek
            const res = await obsApi.fetchKepler('DonemListesi');
            if (!res?.ogrenciDonemListesi) {
                if (!silent) showToast(res?.resultMessage || 'Dönem bulunamadı', 'warning');
                setLoading(false);
                return;
            }

            const freshTermList = [...res.ogrenciDonemListesi];
            freshTermList.reverse(); // latest first

            // Güncel dönemin derslerini çek
            const activeTerm = freshTermList[0];
            if (activeTerm) {
                try {
                    const courses = await fetchClassesAndGrades(activeTerm.akademikDonemId);
                    if (courses) {
                        freshTermList[0] = { ...freshTermList[0], courses };
                    }
                } catch (e) {
                    console.warn('[Courses] Aktif dönem dersleri çekilemedi:', e);
                }
            }

            // Eski dönemleri cache'den al (değişmezler)
            if (cachedTerms) {
                for (let i = 1; i < freshTermList.length; i++) {
                    const cachedMatch = cachedTerms.find(
                        ct => ct.akademikDonemId === freshTermList[i].akademikDonemId
                    );
                    if (cachedMatch?.courses) {
                        freshTermList[i] = { ...freshTermList[i], courses: cachedMatch.courses };
                    }
                }
            } else {
                // İlk yükleme: eski dönemlerin ders listelerini paralel çek
                // Sadece ders listesi — içerikleri/notları değil
                const oldTermTasks = freshTermList.slice(1).map(async (term, idx) => {
                    try {
                        const courses = await fetchClassesAndGrades(term.akademikDonemId);
                        if (courses) {
                            freshTermList[idx + 1] = { ...freshTermList[idx + 1], courses };
                        } else {
                            freshTermList[idx + 1] = { ...freshTermList[idx + 1], courses: [] };
                        }
                    } catch (e) {
                        freshTermList[idx + 1] = { ...freshTermList[idx + 1], courses: [] };
                    }
                });
                await Promise.allSettled(oldTermTasks);
                console.log('[Courses] Tüm eski dönemlerin ders listeleri çekildi');
            }

            setTerms(freshTermList);
            setSelectedTermIndex(0);
            saveTermsToCache(freshTermList);

            // Güncel dönemin tüm derslerinin notlarını paralel olarak prefetch et
            if (freshTermList[0]?.courses?.length > 0) {
                prefetchAllGrades(freshTermList[0].courses);
            }
        } catch (e) {
            console.error('[Courses] API hatası:', e);
            if (!silent) showToast('Dönemler yüklenemedi: ' + e.message, 'error');
        }
        setLoading(false);
    };

    /**
     * Güncel dönemdeki tüm derslerin notlarını eşzamanlı olarak çeker.
     * Her dersin notu hem state'e hem AsyncStorage'a kaydedilir.
     * CourseDetailScreen böylece sıfır gecikmeyle açılır.
     */
    const prefetchAllGrades = async (courseList) => {
        console.log('[Courses] Paralel not prefetch başlıyor:', courseList.length, 'ders');
        
        const results = await Promise.allSettled(
            courseList.map(async (c) => {
                const sinifId = c.sinifId;
                if (!sinifId) return null;

                try {
                    const data = await obsApi.fetchKepler(`sinif/SinifDonemIciNotListesi/${sinifId}`);
                    if (data) {
                        // AsyncStorage'a kaydet
                        await AsyncStorage.setItem(
                            GRADE_CACHE_PREFIX + sinifId,
                            JSON.stringify(data)
                        );
                        return { sinifId, data };
                    }
                } catch (e) {
                    console.warn(`[Courses] Not prefetch hata (${sinifId}):`, e.message);
                }
                return null;
            })
        );

        // State'e yaz → handleCoursePress'te preloadedData olarak gönderilecek
        const gradeMap = {};
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                gradeMap[r.value.sinifId] = r.value.data;
            }
        });
        setPrefetchedGrades(prev => ({ ...prev, ...gradeMap }));
        console.log('[Courses] Prefetch tamamlandı:', Object.keys(gradeMap).length, 'ders notu');
    };

    /**
     * Eski dönemler için: sadece cache'de notu olmayanları API'den çeker.
     * Cache'de zaten varsa tekrar çekmez (eski dönem notları değişmez).
     */
    const prefetchGradesIfNeeded = async (courseList) => {
        // Önce hangi derslerin cache'de olduğunu kontrol et
        const uncachedCourses = [];
        const cachedResults = {};

        await Promise.all(courseList.map(async (c) => {
            if (!c.sinifId) return;
            // Zaten state'te varsa atla
            if (prefetchedGrades[c.sinifId]) {
                cachedResults[c.sinifId] = prefetchedGrades[c.sinifId];
                return;
            }
            try {
                const cached = await AsyncStorage.getItem(GRADE_CACHE_PREFIX + c.sinifId);
                if (cached) {
                    cachedResults[c.sinifId] = JSON.parse(cached);
                } else {
                    uncachedCourses.push(c);
                }
            } catch {
                uncachedCourses.push(c);
            }
        }));

        // Cache'dekileri hemen state'e ekle
        if (Object.keys(cachedResults).length > 0) {
            setPrefetchedGrades(prev => ({ ...prev, ...cachedResults }));
        }

        // Cache'de olmayanları API'den çek
        if (uncachedCourses.length > 0) {
            console.log('[Courses] Eski dönem prefetch:', uncachedCourses.length, 'ders (cache\'de yok)');
            await prefetchAllGrades(uncachedCourses);
        } else {
            console.log('[Courses] Eski dönem: tüm notlar cache\'de');
        }
    };

    // Cache'e kaydet
    const saveTermsToCache = async (termsArr) => {
        try {
            await AsyncStorage.setItem(CACHE_KEY_TERMS, JSON.stringify(stripRawForCache(termsArr)));
            console.log('[Courses] Cache güncellendi');
        } catch (e) {
            console.warn('[Courses] Cache yazma hatası:', e);
        }
    };

    // Dönem değiştiğinde: dersleri yoksa çek, varsa notlarını prefetch et
    useEffect(() => {
        if (terms.length > 0 && selectedTermIndex >= 0) {
            const termToFetch = terms[selectedTermIndex];
            if (termToFetch && !termToFetch.courses) {
                fetchClassesForTerm(termToFetch, terms);
            } else if (termToFetch?.courses?.length > 0 && selectedTermIndex > 0) {
                // Eski dönem: sadece cache'de olmayanların notlarını çek
                prefetchGradesIfNeeded(termToFetch.courses);
            }
        }
    }, [selectedTermIndex]);

    const fetchClassesForTerm = async (term, currentTermsState = terms) => {
        if (!term || term.courses) return;
        
        setLoading(true);
        try {
            const courses = await fetchClassesAndGrades(term.akademikDonemId);
            if (courses) {
                const updatedTerms = [...currentTermsState];
                const index = updatedTerms.findIndex(t => t.akademikDonemId === term.akademikDonemId);
                
                if (index !== -1) {
                    updatedTerms[index] = { ...updatedTerms[index], courses };
                    setTerms(updatedTerms);
                    saveTermsToCache(updatedTerms);

                    // Eski dönemse notlarını da prefetch et (cache'de olmayanları)
                    if (index > 0) {
                        prefetchGradesIfNeeded(updatedTerms[index].courses);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCurrentTermFromApi(null);
        setRefreshing(false);
    };

    const handleCoursePress = (course) => {
        const sinifId = course.sinifId;
        // Prefetch edilen notu varsa preloadedData olarak gönder
        const preloaded = prefetchedGrades[sinifId] || null;
        navigation.navigate('CourseDetail', {
            course: { id: sinifId, name: course.name, harfNotu: course.harfNotu, _raw: course._raw },
            preloadedData: preloaded
        });
    };

    const getGradeColor = (grade) => {
        const gradeColors = {
            'AA': colors.success, 'BA': '#22d3ee', 'BB': colors.accent, 'CB': '#a78bfa',
            'CC': colors.warning, 'DC': '#fb923c', 'DD': colors.danger, 'FF': '#dc2626',
            'CC+': colors.warning, 'DC+': '#fb923c', 'DD+': colors.danger, 'FD+': '#dc2626',
            'BB+': colors.accent, 'CB+': '#a78bfa', 'FD': '#dc2626', 'VF': '#dc2626',
        };
        return gradeColors[grade] || colors.muted;
    };

    const formatTermName = (term) => {
        if (term.akademikDonemAdi) return term.akademikDonemAdi;
        return term.donemKodu;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="book-education-outline" size={24} color={colors.accent} />
                    <Text style={styles.title}>OBS</Text>
                </View>
                {/* Dönem Seçici - sadece ikon */}
                <TouchableOpacity
                    onPress={() => setShowTermPicker(true)}
                    style={styles.backBtn}
                    disabled={terms.length <= 1}
                >
                    <MaterialCommunityIcons name="calendar-clock" size={24} color={terms.length > 1 ? colors.accent : colors.muted} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading && !refreshing ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Dersler yükleniyor...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                >
                    {/* Dönem Bilgisi */}
                    {!isCurrentTerm && selectedTerm && (
                        <View style={styles.termBanner}>
                            <MaterialCommunityIcons name="history" size={16} color={colors.accent} />
                            <Text style={styles.termBannerText}>
                                Geçmiş dönem: {formatTermName(selectedTerm)}
                            </Text>
                        </View>
                    )}

                    {courses.map((course, index) => (
                        <TouchableOpacity
                            key={`${course.crn}-${index}`}
                            style={styles.courseCard}
                            activeOpacity={0.7}
                            onPress={() => handleCoursePress(course)}
                        >
                            <View style={styles.courseIcon}>
                                <MaterialCommunityIcons name="book-education-outline" size={24} color={colors.accent} />
                            </View>
                            <View style={styles.courseInfo}>
                                <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
                        </TouchableOpacity>
                    ))}

                    {courses.length === 0 && (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="book-open-blank-variant" size={64} color={colors.muted} />
                            <Text style={styles.emptyText}>Ders bulunamadı</Text>
                            <Text style={styles.emptySubtext}>Aşağı çekerek verileri güncelleyin</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Dönem Seçim Modalı */}
            <Modal
                visible={showTermPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTermPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowTermPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Dönem Seçin</Text>
                        <FlatList
                            data={terms.filter(t => !t.courses || t.courses.length > 0)}
                            keyExtractor={(item, i) => `${item.akademikDonemId}-${i}`}
                            renderItem={({ item }) => {
                                const originalIndex = terms.findIndex(t => t.akademikDonemId === item.akademikDonemId);
                                return (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        originalIndex === selectedTermIndex && styles.modalItemActive
                                    ]}
                                    onPress={() => {
                                        setSelectedTermIndex(originalIndex);
                                        setShowTermPicker(false);
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.modalItemText,
                                            originalIndex === selectedTermIndex && styles.modalItemTextActive
                                        ]}>
                                            {formatTermName(item)}
                                        </Text>
                                        <Text style={styles.modalItemSub}>
                                            {item.courses?.length || 0} ders
                                        </Text>
                                    </View>
                                    {originalIndex === 0 && (
                                        <View style={styles.currentBadge}>
                                            <Text style={styles.currentBadgeText}>Güncel</Text>
                                        </View>
                                    )}
                                    {originalIndex === selectedTermIndex && (
                                        <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />
                                    )}
                                </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'android' ? 30 : 0
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    backBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: colors.card
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        textShadowColor: colors.accentGlow,
        textShadowRadius: 8
    },
    termBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.card,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        maxWidth: 140,
    },
    termBtnText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '500',
    },
    termBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(41, 121, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(41, 121, 255, 0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    termBannerText: {
        color: colors.accent,
        fontSize: 13,
        fontWeight: '500',
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centerView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    loadingText: {
        color: colors.muted,
        marginTop: 16,
        fontSize: 15
    },
    courseCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        padding: 16, marginBottom: 12, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 3
    },
    courseIcon: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg,
        alignItems: 'center', justifyContent: 'center', marginRight: 14
    },
    courseInfo: {
        flex: 1,
        marginRight: 8
    },
    courseName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    gradeBadge: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        marginRight: 8
    },
    gradeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 80
    },
    emptyText: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8
    },
    emptySubtext: {
        color: colors.muted,
        fontSize: 14,
        textAlign: 'center'
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    modalContent: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxHeight: '60%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 6,
        backgroundColor: colors.bg,
    },
    modalItemActive: {
        backgroundColor: 'rgba(41, 121, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(41, 121, 255, 0.3)',
    },
    modalItemText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '500',
    },
    modalItemTextActive: {
        color: colors.accent,
        fontWeight: '700',
    },
    modalItemSub: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    currentBadge: {
        backgroundColor: 'rgba(0, 230, 118, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    currentBadgeText: {
        color: colors.success,
        fontSize: 11,
        fontWeight: '600',
    },
});
