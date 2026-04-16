import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, LayoutAnimation, UIManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { useObsStore } from '../../store/useObsStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AttendanceDetailsScreen({ navigation }) {
    const { attendanceData } = useObsStore();
    const { widgetRefreshing, refreshWidget } = useAppStore();
    const isRefreshing = !!widgetRefreshing['attendance'];

    // Track expanded courses by CRN
    const [expandedCourses, setExpandedCourses] = useState({});

    // Track expanded weeks by CRN_WeekNum
    const [expandedWeeks, setExpandedWeeks] = useState({});

    const toggleExpand = (crn) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCourses(prev => ({
            ...prev,
            [crn]: !prev[crn]
        }));
    };

    const toggleWeekExpand = (crn, weekNum) => {
        const key = `${crn}_${weekNum}`;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedWeeks(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const onRefresh = () => {
        refreshWidget('attendance');
    };

    if (!attendanceData || Object.keys(attendanceData).length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Devamsızlık Detayları</Text>
                    <View style={{ width: 28 }} />
                </View>
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                >
                    <MaterialCommunityIcons name="calendar-remove" size={64} color={colors.muted} style={{ marginBottom: 20 }} />
                    <Text style={styles.emptyText}>Henüz devamsızlık verisi bulunmuyor.</Text>
                    <Text style={styles.emptySubText}>Aşağı çekerek yenileyebilirsiniz.</Text>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Devamsızlık</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            >
                {Object.keys(attendanceData).map((crn) => {
                    const course = attendanceData[crn];
                    const yoklama = course.yoklama || {};
                    const haftalar = yoklama.yoklamaHaftaListe || [];

                    // Parse actual OBS API structure
                    const processedWeeks = haftalar.map(haftaObj => {
                        const weekNum = haftaObj.hafta || 0;
                        const days = haftaObj.yoklamaSinifZamanListe || [];

                        let dayLabels = [];
                        let classes = [];
                        let daysGrouped = [];

                        days.forEach(day => {
                            const gunAdi = day.gunAdiTR || '';
                            if (gunAdi && !dayLabels.includes(gunAdi)) {
                                dayLabels.push(gunAdi);
                            }

                            const saatler = day.yoklamaSaatListesi || [];
                            // sort safer
                            const sortedSaatler = [...saatler].sort((a, b) => a.saat - b.saat);
                            sortedSaatler.forEach(saat => {
                                classes.push({
                                    saat: saat.saat,
                                    katildiMi: saat.katildiMi,
                                    gunAdi: gunAdi
                                });
                            });

                            daysGrouped.push({
                                gunAdi,
                                saatler: sortedSaatler
                            });
                        });

                        return {
                            weekNum,
                            name: `${weekNum}. Hafta`,
                            label: dayLabels.join(' / '),
                            classes,
                            daysGrouped
                        };
                    });

                    // Sort weeks ascending
                    const sortedWeeks = processedWeeks.sort((a, b) => a.weekNum - b.weekNum);

                    const genelKatilimStr = (yoklama.genelKatilim || '').replace('%', '');
                    const genelKatilimNum = parseFloat(genelKatilimStr);

                    let statusColor = colors.success; // green
                    if (genelKatilimNum < 60) statusColor = colors.danger; // red
                    else if (genelKatilimNum < 70) statusColor = colors.warning; // orange

                    const isExpanded = !!expandedCourses[crn];

                    return (
                        <View key={crn} style={styles.courseCard}>
                            <TouchableOpacity
                                style={[styles.courseHeader, isExpanded && { borderBottomWidth: 1, paddingBottom: 15, marginBottom: 15 }]}
                                onPress={() => toggleExpand(crn)}
                                activeOpacity={1}
                            >
                                <View style={{ flex: 1, marginRight: 15 }}>
                                    <Text style={styles.courseName}>{course.dersAdi}</Text>
                                    <Text style={styles.courseKatilim}>{yoklama.katilim}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                    <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
                                        <Text style={[styles.badgeText, { color: statusColor }]}>
                                            %{genelKatilimNum.toFixed(0)}
                                        </Text>
                                    </View>
                                    {haftalar.length > 0 && (
                                        <MaterialCommunityIcons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color={colors.muted}
                                        />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {isExpanded && sortedWeeks.length > 0 && (
                                <View style={styles.weeksContainer}>
                                    {sortedWeeks.map((weekData, index) => {
                                        const weekKey = `${crn}_${weekData.weekNum}`;
                                        const isWeekExpanded = !!expandedWeeks[weekKey];

                                        // Say how many attended vs total for the badge
                                        const totalClasses = weekData.classes.length;
                                        const attendedClasses = weekData.classes.filter(c => c.katildiMi).length;

                                        let weekStatusColor = colors.success;
                                        if (attendedClasses === 0 && totalClasses > 0) weekStatusColor = colors.danger;
                                        else if (attendedClasses < totalClasses) weekStatusColor = colors.warning;

                                        return (
                                            <View key={index} style={styles.weekItemContainer}>
                                                <TouchableOpacity
                                                    style={styles.weekItem}
                                                    onPress={() => toggleWeekExpand(crn, weekData.weekNum)}
                                                    activeOpacity={1}
                                                >
                                                    <View style={styles.weekLeft}>
                                                        <Text style={styles.weekTitle}>{weekData.name}</Text>
                                                        <Text style={styles.weekDate}>
                                                            {weekData.label}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                        <Text style={{ color: weekStatusColor, fontWeight: 'bold', fontSize: 13 }}>
                                                            {attendedClasses}/{totalClasses}
                                                        </Text>
                                                        <MaterialCommunityIcons
                                                            name={isWeekExpanded ? "chevron-up" : "chevron-down"}
                                                            size={20}
                                                            color={colors.muted}
                                                        />
                                                    </View>
                                                </TouchableOpacity>

                                                {isWeekExpanded && (
                                                    <View style={styles.weekDetailsInner}>
                                                        {weekData.daysGrouped.map((dayGroup, dIdx) => (
                                                            <View key={dIdx} style={styles.dayBlock}>
                                                                <Text style={styles.dayBlockTitle}>
                                                                    {dayGroup.gunAdi}
                                                                </Text>
                                                                <View style={styles.dayBlockIcons}>
                                                                    {dayGroup.saatler.map((saat, sIdx) => (
                                                                        <View key={sIdx} style={[styles.hourBadge, { backgroundColor: saat.katildiMi ? colors.success + '20' : colors.danger + '20' }]}>
                                                                            <MaterialCommunityIcons
                                                                                name={saat.katildiMi ? 'check' : 'close'}
                                                                                size={16}
                                                                                color={saat.katildiMi ? colors.success : colors.danger}
                                                                            />
                                                                            <Text style={[styles.hourText, { color: saat.katildiMi ? colors.success : colors.danger }]}>
                                                                                {saat.saat}. Saat
                                                                            </Text>
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 5,
        marginLeft: -5,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    emptySubText: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    courseCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 0,
        borderBottomColor: colors.border,
        paddingBottom: 0,
        marginBottom: 0,
    },
    courseName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 6,
    },
    courseKatilim: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 16,
        fontWeight: '900',
    },
    weeksContainer: {
        gap: 10,
    },
    weekItemContainer: {
        backgroundColor: colors.card,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    weekItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    weekLeft: {
        gap: 4,
    },
    weekTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
    },
    weekDate: {
        color: colors.muted,
        fontSize: 12,
    },
    weekDetailsInner: {
        paddingHorizontal: 15,
        paddingBottom: 15,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: colors.border + '50',
    },
    dayBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dayBlockTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 10,
    },
    dayBlockIcons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        flex: 1,
        gap: 8,
    },
    hourBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    hourText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});
