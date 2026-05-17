import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FinalScheduleWidget({ finalSchedule, onRefresh, refreshing }) {

    const processFinals = (list) => {
        if (!list || !Array.isArray(list)) return [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return list.map(item => {
            const start = new Date(item.baslangicTarihi);
            const end = new Date(item.bitisTarihi);

            const examDateStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());

            let status = 'upcoming';
            let diffDays = Math.round((examDateStart - todayStart) / (1000 * 60 * 60 * 24));

            if (now > end) status = 'ended';
            else if (now >= start) status = 'active';

            return {
                ...item,
                startDate: start,
                endDate: end,
                status,
                diffDays
            };
        })
            .filter(item => item.status !== 'ended')
            .sort((a, b) => a.startDate - b.startDate)
            .slice(0, 3); // Only show next 3 exams
    };

    const displayFinals = processFinals(finalSchedule);
    const hasFinals = displayFinals.length > 0;

    const formatDate = (date) => {
        const options = { day: 'numeric', month: 'long', weekday: 'short' };
        return date.toLocaleDateString('tr-TR', options);
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                        {refreshing ? (
                            <ActivityIndicator size={16} color={colors.accent} />
                        ) : (
                            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.title}>FİNAL SINAVLARI</Text>
                </View>
            </View>

            <View style={styles.content}>
                {hasFinals ? (
                    <View style={styles.list}>
                        {displayFinals.map((exam, idx) => (
                            <View key={idx} style={styles.examItem}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dateDay}>{exam.startDate.getDate()}</Text>
                                    <Text style={styles.dateMonth}>
                                        {exam.startDate.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.examInfo}>
                                    <Text style={styles.examName} numberOfLines={1}>{exam.dersKodu} - {exam.dersAdiTR}</Text>
                                    <View style={styles.detailsRow}>
                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.muted} />
                                            <Text style={styles.detailText}>{formatTime(exam.startDate)}</Text>
                                        </View>
                                        <View style={[styles.detailItem, { marginLeft: 10 }]}>
                                            <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.muted} />
                                            <Text style={styles.detailText} numberOfLines={1}>
                                                {exam.finalMekanList?.[0]?.derslikKodu || 'Belli Değil'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.statusBox}>
                                    {exam.diffDays > 0 ? (
                                        <Text style={styles.daysText}>
                                            {`${exam.diffDays} gün`}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Yaklaşan final sınavı bulunamadı.</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        backgroundColor: 'rgba(41, 121, 255, 0.1)',
        padding: 6,
        borderRadius: 8,
        marginRight: 10,
    },
    title: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    content: {
        width: '100%',
    },
    list: {
        gap: 10,
    },
    examItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardHover,
        padding: 12,
        borderRadius: 12,
    },
    activeItem: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderColor: colors.success,
        borderWidth: 1,
    },
    dateBox: {
        width: 45,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: colors.border,
        marginRight: 12,
    },
    dateDay: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    dateMonth: {
        color: colors.accent,
        fontSize: 10,
        fontWeight: 'bold',
    },
    examInfo: {
        flex: 1,
    },
    examName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        color: colors.muted,
        fontSize: 11,
        marginLeft: 3,
    },
    statusBox: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 50,
    },
    daysText: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: 'bold',
    },
    liveBadge: {
        backgroundColor: colors.success,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    liveText: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
    },
    emptyState: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.muted,
        fontSize: 13,
    }
});
