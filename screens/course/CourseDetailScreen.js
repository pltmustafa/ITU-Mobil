import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ScrollView, ActivityIndicator, Modal, Platform, StatusBar, Dimensions
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import obsApi from '../../services/obsApi';
import { useToast } from '../../components/common/Toast';

const GRADE_CACHE_PREFIX = 'obs_grades_';

export default function CourseDetailScreen({ navigation, route }) {
    const { course, preloadedData } = route.params || {};
    const [grades, setGrades] = useState(preloadedData || null);
    const [loading, setLoading] = useState(!preloadedData);
    const [examModalVisible, setExamModalVisible] = useState(false);
    const [examModalData, setExamModalData] = useState(null);
    const { showToast, ToastComponent } = useToast();

    const sinifIdRef = useRef(course?._raw?.sinifId || course?.id);

    // ─── Preloaded → Cache → API (sadece veri yoksa) ───
    useEffect(() => {
        if (!sinifIdRef.current || preloadedData) return; // Preloaded varsa zaten gösteriliyor

        const init = async () => {
            const cacheKey = GRADE_CACHE_PREFIX + sinifIdRef.current;

            // Cache'den yükle
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed) {
                        setGrades(parsed);
                        setLoading(false);
                        console.log('[CourseDetail] Cache\'den yüklendi:', sinifIdRef.current);
                        return; // Cache varsa yeterli, tekrar çekme
                    }
                }
            } catch (e) {
                console.warn('[CourseDetail] Cache okuma hatası:', e);
            }

            // Cache yoksa API'den çek
            await loadGradesFromApi(false);
        };
        init();
    }, [course]);

    const loadGradesFromApi = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const sinifId = sinifIdRef.current;
            if (sinifId) {
                const data = await obsApi.fetchKepler(`sinif/SinifDonemIciNotListesi/${sinifId}`);
                if (data) {
                    setGrades(data);
                    // Cache'e kaydet
                    try {
                        await AsyncStorage.setItem(
                            GRADE_CACHE_PREFIX + sinifId,
                            JSON.stringify(data)
                        );
                        console.log('[CourseDetail] Cache güncellendi:', sinifId);
                    } catch (e) {
                        console.warn('[CourseDetail] Cache yazma hatası:', e);
                    }
                }
            } else {
                if (!silent) showToast('Sınıf ID bulunamadı', 'error');
            }
        } catch (err) {
            if (!silent) showToast(err.message || 'Notlar yüklenemedi', 'error');
        }
        finally { setLoading(false); }
    };



    const openExamDetail = (item) => {
        const score = item.not ?? item.puan ?? '-';
        const weight = item.degerlendirmeKatkisi || 0;
        const contribution = !isNaN(parseFloat(score)) && !isNaN(parseFloat(weight))
            ? ((parseFloat(score) * parseFloat(weight)) / 100).toFixed(2) : '0.00';
        setExamModalData({
            name: item.degerlendirmeOlcutuAdi || 'Değerlendirme',
            score, avg: item.ortalama || '-', rank: item.sinifSirasi || '-',
            total: item.ogrenciSayisi || '-', stdDev: item.standartSapma || '-',
            weight, contribution
        });
        setExamModalVisible(true);
    };

    const gradeList = grades?.sinifDonemIciNotListesi || [];
    const letterGrade = course?.harfNotu || grades?.harfNotu || null;
    const average = grades?.ortalama || null;

    const getGradeColor = (grade) => {
        const colors_map = {
            'AA': colors.success, 'BA+': '#22d3ee', 'BA': '#22d3ee', 'BB+': colors.accent, 'BB': colors.accent,
            'CB+': '#a78bfa', 'CB': '#a78bfa', 'CC+': colors.warning, 'CC': colors.warning,
            'DC+': '#fb923c', 'DC': '#fb923c', 'DD+': colors.danger, 'DD': colors.danger,
            'FF': '#dc2626', 'VF': '#dc2626',
        };
        return colors_map[grade] || colors.muted;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title} numberOfLines={1}>{course?.name || 'Ders Detayı'}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Notlar yükleniyor...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Harf Notu ve Ortalama */}
                    <View style={styles.statsRow}>
                        {letterGrade && (
                            <View style={[styles.statCard, { backgroundColor: colors.accent }]}>
                                <MaterialCommunityIcons name="school-outline" size={24} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.statValue}>{letterGrade}</Text>
                                <Text style={styles.statLabel}>Harf Notu</Text>
                            </View>
                        )}
                        {average && average !== '-' && (
                            <View style={styles.statCard}>
                                <MaterialCommunityIcons name="chart-line" size={24} color={colors.accent} />
                                <Text style={[styles.statValue, { color: colors.accent }]}>{average}</Text>
                                <Text style={styles.statLabel}>Ortalama</Text>
                            </View>
                        )}
                    </View>

                    {/* Sınav Notları */}
                    <View style={styles.cardTitleRow}>
                        <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.accent} />
                        <Text style={styles.sectionTitle}>Sınav Notları</Text>
                    </View>
                    <View style={{ height: 12 }} />
                    {gradeList.length > 0 ? (
                        gradeList.map((item, idx) => {
                            const name = item.degerlendirmeOlcutuAdi || 'Değerlendirme';
                            const score = item.not ?? item.puan ?? '-';
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.examCard}
                                    onPress={() => openExamDetail(item)}
                                >
                                    <View style={styles.gradeInfo}>
                                        <Text style={styles.gradeName}>{name}</Text>
                                    </View>
                                    <View style={styles.gradeScoreWrap}>
                                        <Text style={[styles.gradeScore, score === '-' && { color: colors.muted }]}>
                                            {score}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={colors.muted} />
                            <Text style={styles.emptyText}>Henüz sınav notu girilmemiş</Text>
                        </View>
                    )}
                </ScrollView>
            )}



            {/* Sınav Detay Popup — Web tasarımının mobil uyarlaması */}
            <Modal visible={examModalVisible} transparent animationType="fade" onRequestClose={() => setExamModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setExamModalVisible(false)}>
                    <View style={styles.examModal} onStartShouldSetResponder={() => true}>
                        <Text style={styles.examModalName}>{examModalData?.name}</Text>

                        {/* Score Circle — web'deki modal-score-circle */}
                        <View style={styles.scoreCircle}>
                            <Text style={styles.scoreVal} adjustsFontSizeToFit numberOfLines={1}>{examModalData?.score}</Text>
                            <Text style={styles.scoreLabel}>NOT</Text>
                        </View>

                        {/* 2x2 Grid — web'deki modal-grid */}
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <MaterialCommunityIcons name="account-group-outline" size={18} color={colors.accent} />
                                <Text style={styles.statBoxVal}>{examModalData?.avg}</Text>
                                <Text style={styles.statBoxLabel}>Sınıf Ort.</Text>
                            </View>
                            <View style={styles.statBox}>
                                <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.warning} />
                                <Text style={styles.statBoxVal}>{examModalData?.rank}/{examModalData?.total}</Text>
                                <Text style={styles.statBoxLabel}>Sıralama</Text>
                            </View>
                            <View style={styles.statBox}>
                                <MaterialCommunityIcons name="chart-bar" size={18} color="#a855f7" />
                                <Text style={styles.statBoxVal}>{examModalData?.stdDev}</Text>
                                <Text style={styles.statBoxLabel}>Std. Sapma</Text>
                            </View>
                            <View style={styles.statBox}>
                                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.success} />
                                <Text style={[styles.statBoxVal, { color: colors.success }]}>+{examModalData?.contribution}</Text>
                                <Text style={styles.statBoxLabel}>Ort. Katkısı</Text>
                            </View>
                        </View>

                        <Text style={styles.examFooter}>Bu sınavın ders notuna etkisi: %{examModalData?.weight}</Text>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    headerCenter: { flex: 1, marginHorizontal: 12, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statCard: {
        flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 20,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4
    },
    statValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 8 },
    statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
    statHint: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 6 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    examCard: {
        backgroundColor: colors.card, borderRadius: 16,
        padding: 18, marginBottom: 10,
        borderWidth: 1, borderColor: colors.border,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
    },
    gradeInfo: { flex: 1 },
    gradeName: { color: colors.text, fontSize: 16, fontWeight: '600' },
    gradeSubtext: { color: colors.muted, fontSize: 12, marginTop: 4 },
    gradeScoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    gradeScore: { color: colors.accent, fontSize: 22, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', padding: 30 },
    emptyText: { color: colors.muted, textAlign: 'center', marginTop: 12, fontSize: 14 },

    // Shared Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    distModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.muted, alignSelf: 'center', marginBottom: 16, opacity: 0.4 },



    // Sınav Detay Popup — web modal tasarımı
    examModal: {
        backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '99%',
        borderWidth: 1, borderColor: colors.border,
    },
    examModalName: {
        color: colors.text, fontSize: 18, fontWeight: 'bold',
        textAlign: 'center', marginBottom: 20,
    },
    scoreCircle: {
        width: 130, height: 130, borderRadius: 65,
        borderWidth: 4, borderColor: colors.accent,
        backgroundColor: 'rgba(41, 121, 255, 0.05)',
        justifyContent: 'center', alignItems: 'center',
        alignSelf: 'center', marginBottom: 20,
    },
    scoreVal: {
        color: colors.accent, fontSize: 30, fontWeight: '800',
        textAlign: 'center',
    },
    scoreLabel: {
        color: colors.muted, fontSize: 11, fontWeight: '600',
        textTransform: 'uppercase', marginTop: 5,
    },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        gap: 10, marginTop: 4, marginBottom: 16,
    },
    statBox: {
        width: '47%', backgroundColor: colors.bg,
        borderRadius: 10, padding: 15, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    statBoxVal: {
        color: colors.text, fontSize: 16, fontWeight: 'bold',
        marginTop: 6,
    },
    statBoxLabel: {
        color: colors.muted, fontSize: 11, marginTop: 3,
    },
    examFooter: {
        color: colors.muted, fontSize: 12, textAlign: 'center',
        marginBottom: 16,
    },
    examCloseBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
    examCloseBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
