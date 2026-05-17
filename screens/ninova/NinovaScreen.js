import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, RefreshControl, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ninovaApi from '../../services/ninovaApi';
import { useToast } from '../../components/common/Toast';

const CACHE_KEY_COURSES = 'ninova_courses_cache_v1';
const CACHE_KEY_FILES_PREFIX = 'ninova_files_';

export default function NinovaScreen({ navigation }) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [prefetchedFiles, setPrefetchedFiles] = useState({});
    const { showToast, ToastComponent } = useToast();
    const initialLoadDone = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (!initialLoadDone.current) {
                loadCoursesWithCache();
            }
        }, [])
    );

    /**
     * Cache-first: önce AsyncStorage'dan yükle → sonra sessizce API'den güncelle
     * Sadece ilk mount'ta çalışır, geri dönüşlerde tekrar çağrılmaz.
     */
    const loadCoursesWithCache = async () => {
        // 1. Cache'den yükle → anında UI
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY_COURSES);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.length > 0) {
                    setCourses(parsed);
                    setLoading(false);
                    console.log('[Ninova] Cache\'den yüklendi:', parsed.length, 'ders');
                }
            }
        } catch (e) {
            console.warn('[Ninova] Cache okuma hatası:', e);
        }

        // 2. Sessizce API'den güncel veriyi çek
        try {
            const list = await ninovaApi.getNinovaCourses();
            if (list?.length > 0) {
                setCourses(list);
                setLoading(false);
                await AsyncStorage.setItem(CACHE_KEY_COURSES, JSON.stringify(list));
                console.log('[Ninova] API\'den güncellendi:', list.length, 'ders');
            }
        } catch (error) {
            if (courses.length === 0) {
                showToast(error.message || 'Ninova Dersleri yüklenemedi', 'error');
            }
            setLoading(false);
        }

        initialLoadDone.current = true;
    };

    /**
     * Tek bir dersin dosya listelerini rekürsif olarak API'den çeker.
     * Ders seçildiğinde tetiklenir — tüm dersleri değil sadece seçileni prefetch eder.
     */
    const prefetchCourseFiles = async (course) => {
        const { DersId, SinifId } = course;
        const prefetched = {};

        const fetchRecursive = async (caseType, catKey, path) => {
            const pathSuffix = path ? `_${path.replace(/\//g, '_')}` : '';
            const cacheKey = `${CACHE_KEY_FILES_PREFIX}${DersId}_${SinifId}_${catKey}${pathSuffix}`;

            try {
                const result = await ninovaApi.getNinovaFiles(DersId, SinifId, caseType, path);
                if (result && result.length > 0) {
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
                    prefetched[cacheKey] = result;

                    const folders = result.filter(item => item.TypeId == 1);
                    if (folders.length > 0) {
                        await Promise.allSettled(
                            folders.map(folder => {
                                const subPath = (path || '') + folder.DosyaAdi + '/';
                                return fetchRecursive(caseType, catKey, subPath);
                            })
                        );
                    }
                } else if (result) {
                    prefetched[cacheKey] = result;
                }
                } catch (e) {
                    try {
                        const cached = await AsyncStorage.getItem(cacheKey);
                        if (cached) prefetched[cacheKey] = JSON.parse(cached);
                    } catch {}
                }
            };
    
        await Promise.allSettled([
            fetchRecursive(1, 'ders', ''),
            fetchRecursive(0, 'sinif', ''),
            (async () => {
                const homeworkCacheKey = `${CACHE_KEY_FILES_PREFIX}${DersId}_${SinifId}_homeworks`;
                try {
                    const homeworks = await ninovaApi.getNinovaHomeworks(DersId, SinifId);
                    if (homeworks) {
                        await AsyncStorage.setItem(homeworkCacheKey, JSON.stringify(homeworks));
                        prefetched[homeworkCacheKey] = homeworks;
                    }
                } catch (e) {
                    console.warn('[Ninova] Homework prefetch error:', e);
                }
            })()
        ]);

        setPrefetchedFiles(prev => ({ ...prev, ...prefetched }));
        console.log(`[Ninova] ${course.SinifAdi} prefetch tamamlandı:`, Object.keys(prefetched).length, 'liste');
        return prefetched;
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const list = await ninovaApi.getNinovaCourses();
            if (list?.length > 0) {
                setCourses(list);
                await AsyncStorage.setItem(CACHE_KEY_COURSES, JSON.stringify(list));
            }
        } catch (error) {
            showToast(error.message || 'Yenilenemedi', 'error');
        }
        setRefreshing(false);
    };

    const navigateToCourse = async (course) => {
        const coursePrefix = `${CACHE_KEY_FILES_PREFIX}${course.DersId}_${course.SinifId}_`;

        // Zaten prefetch edilmiş mi kontrol et
        const alreadyPrefetched = Object.keys(prefetchedFiles).some(k => k.startsWith(coursePrefix));

        if (alreadyPrefetched) {
            // Önceden prefetch edilmiş veriyi kullan
            const preloadedFiles = {};
            const dersKey = coursePrefix + 'ders';
            const sinifKey = coursePrefix + 'sinif';
            const homeworkKey = coursePrefix + 'homeworks';
            if (prefetchedFiles[dersKey]) preloadedFiles.ders = prefetchedFiles[dersKey];
            if (prefetchedFiles[sinifKey]) preloadedFiles.sinif = prefetchedFiles[sinifKey];
            if (prefetchedFiles[homeworkKey]) preloadedFiles.homeworks = prefetchedFiles[homeworkKey];

            const allPrefetched = {};
            Object.keys(prefetchedFiles).forEach(key => {
                if (key.startsWith(coursePrefix)) allPrefetched[key] = prefetchedFiles[key];
            });

            navigation.navigate('NinovaDetail', {
                title: course.SinifAdi,
                dersId: course.DersId,
                sinifId: course.SinifId,
                pathStr: '',
                preloadedFiles: Object.keys(preloadedFiles).length > 0 ? preloadedFiles : undefined,
                allPrefetchedFiles: Object.keys(allPrefetched).length > 0 ? allPrefetched : undefined
            });
        } else {
            // Hemen navigate et, arka planda prefetch başlat
            navigation.navigate('NinovaDetail', {
                title: course.SinifAdi,
                dersId: course.DersId,
                sinifId: course.SinifId,
                pathStr: ''
            });
            // Arka planda prefetch — sonraki girişlerde cache'den gelecek
            prefetchCourseFiles(course);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="school-outline" size={24} color={colors.accent} />
                    <Text style={styles.title}>Ninova</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Sınıflar yükleniyor...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                >
                    {courses.length > 0 ? (
                        courses.map((course, idx) => (
                            <TouchableOpacity
                                key={`${course.SinifId}-${idx}`}
                                style={styles.courseCard}
                                onPress={() => navigateToCourse(course)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.courseIcon}>
                                    <MaterialCommunityIcons name="book-open-variant" size={24} color={colors.accent} />
                                </View>
                                <Text style={styles.courseName} numberOfLines={2}>{course.SinifAdi}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="school-outline" size={64} color={colors.muted} />
                            <Text style={styles.emptyText}>Ninova verisi bulunamadı</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },
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
    courseName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 }
});
