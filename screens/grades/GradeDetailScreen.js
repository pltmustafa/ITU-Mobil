import React, { useState, useEffect, useMemo } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ScrollView, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import gradeHelper from '../../services/gradeHelper';

const BAR_COLOR = colors.accent;
const BAR_BG = 'rgba(41, 121, 255, 0.08)';
const failGrades = ['FF', 'VF', 'FD', 'NA'];

export default function GradeDetailScreen({ navigation, route }) {
    const { course } = route.params;
    const [courseData, setCourseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedDonemIdx, setSelectedDonemIdx] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log(`[GradeDetailScreen] Fetching detail for: ${course.tamKod}`);
            // Statik verimizden ders detayını (dönem dağılımlarını) çekiyoruz
            const data = await gradeHelper.getCourseDetail(course.bransKodu, course.dersNo);
            console.log(`[GradeDetailScreen] Data received:`, data ? 'YES' : 'NO');
            setCourseData(data);
        } catch (e) {
            console.error('[GradeDetailScreen] Error fetching data:', e);
            setCourseData(null);
        }
        setLoading(false);
    };

    // Yılları grupla
    const years = useMemo(() => {
        const dataList = courseData?.donemler || courseData?.terms;
        if (!dataList) return [];
        const yilMap = {};
        dataList.forEach((d, i) => {
            const yil = d.yilAdi?.split('-')[1] || d.yilAdi || 'Bilinmeyen';
            if (!yilMap[yil]) yilMap[yil] = [];
            yilMap[yil].push({ ...d, _idx: i });
        });
        return Object.entries(yilMap).map(([yil, donemler]) => ({ yil, donemler })).reverse();
    }, [courseData]);

    // Seçili yılın dönemleri
    const currentYearDonemler = selectedYear !== null ? years[selectedYear]?.donemler : [];

    // Seçili dönem verisi
    const currentDonem = selectedDonemIdx !== null ? (courseData?.donemler?.[selectedDonemIdx] || courseData?.terms?.[selectedDonemIdx]) : null;
    const maxSayi = currentDonem?.dagilim ? Math.max(...currentDonem.dagilim.map(d => d.Sayi), 1) : 1;

    const handleYearSelect = (idx) => {
        setSelectedYear(idx);
        setSelectedDonemIdx(null); // Dönem seçimini sıfırla
    };

    const handleDonemSelect = (donem) => {
        setSelectedDonemIdx(donem._idx);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="chart-bar" size={22} color={colors.accent} />
                    <Text style={styles.title}>{course.tamKod}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
                </View>
            ) : !courseData || ((courseData.donemler || courseData.terms || []).length === 0) ? (
                <View style={styles.centerView}>
                    <MaterialCommunityIcons name="database-off-outline" size={64} color={colors.muted} />
                    <Text style={styles.emptyTitle}>Veri Bulunamadı</Text>
                    <Text style={styles.emptyDesc}>Bu ders için not dağılımı verisi yok</Text>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Step 1: Yıl Seçimi */}
                    <Text style={styles.sectionTitle}>Yıl Seçimi</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                        {years.map((y, i) => (
                            <TouchableOpacity
                                key={y.yil}
                                style={[styles.yearChip, selectedYear === i && styles.chipActive]}
                                onPress={() => handleYearSelect(i)}
                            >
                                <Text style={[styles.yearChipText, selectedYear === i && styles.chipTextActive]}>
                                    {y.yil}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Step 2: Dönem Seçimi (yıl seçildiyse) */}
                    {selectedYear !== null && currentYearDonemler.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Dönem Seçimi</Text>
                            <View style={styles.donemRow}>
                                {currentYearDonemler.map((d) => {
                                    const tip = d.donemTip?.includes('Güz') ? 'Güz'
                                        : d.donemTip?.includes('Bahar') ? 'Bahar'
                                            : d.donemTip?.includes('Yaz') ? 'Yaz' : d.donemTip || '';
                                    const isActive = selectedDonemIdx === d._idx;
                                    const icon = tip === 'Güz' ? 'leaf' : tip === 'Bahar' ? 'flower' : 'white-balance-sunny';
                                    return (
                                        <TouchableOpacity
                                            key={d.donemKodu}
                                            style={[styles.donemCard, isActive && styles.donemCardActive]}
                                            onPress={() => handleDonemSelect(d)}
                                        >
                                            <MaterialCommunityIcons
                                                name={icon}
                                                size={22}
                                                color={isActive ? '#fff' : colors.muted}
                                            />
                                            <Text style={[styles.donemCardText, isActive && styles.chipTextActive]}>
                                                {tip}
                                            </Text>
                                            <Text style={[styles.donemStudentCount, isActive && { color: 'rgba(255,255,255,0.7)' }]}>
                                                {d.toplamOgrenci} öğrenci
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/* Step 3: Bar Chart (dönem seçildiyse) */}
                    {currentDonem?.dagilim && (
                        <View style={styles.chartCard}>
                            <View style={styles.chartHeader}>
                                <MaterialCommunityIcons name="chart-bar" size={18} color={colors.accent} />
                                <Text style={styles.chartTitle}>
                                    {currentDonem.yilAdi} — {currentDonem.donemTip}
                                </Text>
                                <Text style={styles.chartSubtitle}>
                                    {currentDonem.toplamOgrenci} öğrenci
                                </Text>
                            </View>
                            {currentDonem.dagilim.map((item) => {
                                const pct = (item.Sayi / maxSayi) * 100;
                                return (
                                    <View key={item.HarfNotu} style={styles.barRow}>
                                        <Text style={styles.barLabel}>
                                            {item.HarfNotu}
                                        </Text>
                                        <View style={styles.barTrack}>
                                            <View
                                                style={[
                                                    styles.barFill,
                                                    {
                                                        width: `${Math.max(pct, 1.5)}%`,
                                                        backgroundColor: BAR_COLOR,
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.barValue}>{item.Sayi}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Hint: henüz seçim yapılmadıysa */}
                    {selectedYear === null && (
                        <View style={styles.hint}>
                            <MaterialCommunityIcons name="gesture-tap" size={24} color={colors.muted} />
                            <Text style={styles.hintText}>Grafiği görmek için bir yıl seçin</Text>
                        </View>
                    )}
                    {selectedYear !== null && selectedDonemIdx === null && (
                        <View style={styles.hint}>
                            <MaterialCommunityIcons name="gesture-tap" size={24} color={colors.muted} />
                            <Text style={styles.hintText}>Dönem seçerek grafiği görüntüleyin</Text>
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
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8,
    },

    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },
    emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
    emptyDesc: { color: colors.muted, fontSize: 14, marginTop: 8 },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

    sectionTitle: {
        fontSize: 13, fontWeight: '600', color: colors.muted,
        marginBottom: 8, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5,
    },

    // Year chips
    chipScroll: { flexGrow: 0, marginBottom: 4 },
    yearChip: {
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
        marginRight: 7,
    },
    chipActive: {
        backgroundColor: colors.accent, borderColor: colors.accent,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4, shadowRadius: 6,
    },
    yearChipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#fff' },

    // Dönem cards
    donemRow: { flexDirection: 'row', gap: 10 },
    donemCard: {
        flex: 1, backgroundColor: colors.card, borderRadius: 12,
        padding: 14, alignItems: 'center', gap: 5,
        borderWidth: 1, borderColor: colors.border,
    },
    donemCardActive: {
        backgroundColor: colors.accent, borderColor: colors.accent,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4, shadowRadius: 6,
    },
    donemCardText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    donemStudentCount: { color: colors.muted, fontSize: 11, fontWeight: '600' },

    // Chart Card
    chartCard: {
        backgroundColor: colors.card, borderRadius: 14,
        padding: 14, borderWidth: 1, borderColor: colors.border, marginTop: 14,
    },
    chartHeader: {
        alignItems: 'center', gap: 3, marginBottom: 12,
    },
    chartTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    chartSubtitle: { color: colors.muted, fontSize: 11 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 5 },
    barLabel: { width: 28, color: colors.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'right' },
    barTrack: { flex: 1, height: 22, backgroundColor: BAR_BG, borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 6 },
    barValue: { width: 30, color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
    barPercent: { width: 38, color: colors.muted, fontSize: 11, textAlign: 'right' },

    // Hint
    hint: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 24, opacity: 0.6,
    },
    hintText: { color: colors.muted, fontSize: 14 },
});
