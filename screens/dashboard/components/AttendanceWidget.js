import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AttendanceWidget({ data, refreshing, onRefresh, onPress }) {
    if (!data || Object.keys(data).length === 0) {
        return (
            <TouchableOpacity style={styles.container} onPress={onRefresh} activeOpacity={0.8}>
                <View style={styles.header}>
                    <Text style={styles.title}>DEVAMSIZLIK</Text>
                    <MaterialCommunityIcons name="calendar-refresh" size={20} color={colors.textSecondary} />
                </View>
                <Text style={styles.emptyText}>Henüz devamsızlık verisi yok. (Yenilemek için dokunun)</Text>
            </TouchableOpacity>
        );
    }

    // Filter courses with < 70% or no attendance data
    const courseKeys = Object.keys(data);
    const lowAttendanceCourses = courseKeys.filter(key => {
        const yoklama = data[key]?.yoklama;
        if (!yoklama || Object.keys(yoklama).length === 0) return false; // Ignore courses with no data? Or show them? Let's hide them from warnings.
        const genelKatilimStr = (yoklama.genelKatilim || '').replace('%', '');
        return parseFloat(genelKatilimStr) < 70;
    });

    if (lowAttendanceCourses.length === 0) {
        return (
            <TouchableOpacity style={styles.container} onPress={onRefresh} activeOpacity={0.8}>
                <View style={[styles.header, { marginBottom: 6 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="shield-check" size={20} color={colors.success} />
                        <Text style={styles.title}>DEVAMSIZLIK</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
                </View>
                <Text style={[styles.emptyText, { color: colors.success, fontStyle: 'normal', fontWeight: 'bold' }]}>
                    Tüm derslerinize yeterli devamsızlık oranında (%70+) katılım sağladınız! 🎉
                </Text>
            </TouchableOpacity>
        );
    }

    const displayedCourses = lowAttendanceCourses.slice(0, 3);
    const hasMore = lowAttendanceCourses.length > 3;

    return (
        <TouchableOpacity
            style={[styles.container, refreshing && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.accent} />
                    <Text style={styles.title}>DEVAMSIZLIK</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
            </View>

            <View style={styles.list}>
                {displayedCourses.map((key) => {
                    const course = data[key];
                    const yoklama = course.yoklama || {};

                    const genelKatilimStr = (yoklama.genelKatilim || '').replace('%', '');
                    const genelKatilimNum = parseFloat(genelKatilimStr);

                    // Determine status color based on participation
                    let statusColor = colors.success; // > 70% is green
                    if (genelKatilimNum < 60) statusColor = colors.danger; // red
                    else if (genelKatilimNum < 70) statusColor = colors.warning; // orange

                    // Format katilim text e.g "0 / 8 (%0.0)" -> "0/8"
                    let katilimText = yoklama.katilim || '-';
                    if (katilimText.includes('(')) {
                        katilimText = katilimText.split('(')[0].trim().replace(' / ', '/');
                    }

                    return (
                        <View key={key} style={styles.item}>
                            <View style={styles.itemLeft}>
                                <Text style={styles.courseName} numberOfLines={2}>{course.dersAdi}</Text>
                            </View>
                            <View style={styles.itemRight}>
                                <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
                                    <Text style={[styles.badgeText, { color: statusColor }]}>
                                        %{genelKatilimNum.toFixed(0)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>

            {hasMore && (
                <Text style={styles.moreText}>+{courseKeys.length - 3} ders daha...</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    list: {
        gap: 12,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemLeft: {
        flex: 1,
        marginRight: 10,
    },
    courseName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: 'bold',
    },
    itemRight: {
        alignItems: 'flex-end',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyText: {
        color: colors.muted,
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10,
        marginBottom: 5
    },
    moreText: {
        color: colors.accent,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '600'
    }
});
