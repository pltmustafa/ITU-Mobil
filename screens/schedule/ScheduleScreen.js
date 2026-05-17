import React, { useMemo, useState, useRef } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity,
    Platform, StatusBar, Dimensions, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useObsStore } from '../../store/useObsStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COL_WIDTH = 46;
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const HOUR_HEIGHT = 60; // px per hour

// Pastel renk paleti (her derse farklı renk)
const COURSE_COLORS = [
    { bg: 'rgba(41, 121, 255, 0.25)', border: '#2979FF', text: '#8AB4FF' },   // blue
    { bg: 'rgba(76, 175, 80, 0.25)', border: '#4CAF50', text: '#81C784' },    // green
    { bg: 'rgba(255, 152, 0, 0.25)', border: '#FF9800', text: '#FFB74D' },    // orange
    { bg: 'rgba(156, 39, 176, 0.25)', border: '#9C27B0', text: '#CE93D8' },   // purple
    { bg: 'rgba(233, 30, 99, 0.25)', border: '#E91E63', text: '#F48FB1' },    // pink
    { bg: 'rgba(0, 188, 212, 0.25)', border: '#00BCD4', text: '#80DEEA' },    // cyan
    { bg: 'rgba(255, 87, 34, 0.25)', border: '#FF5722', text: '#FF8A65' },    // deep orange
    { bg: 'rgba(63, 81, 181, 0.25)', border: '#3F51B5', text: '#9FA8DA' },    // indigo
];

export default function ScheduleScreen({ navigation }) {
    const classes = useObsStore(s => s.classes);
    const [selectedClass, setSelectedClass] = useState(null);

    // Ders koduna göre renk eşlemesi
    const colorMap = useMemo(() => {
        const map = {};
        let colorIdx = 0;
        (classes || []).forEach(cls => {
            if (!map[cls.code]) {
                map[cls.code] = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
                colorIdx++;
            }
        });
        return map;
    }, [classes]);

    // Günlere göre dersleri grupla ve zaman hesapla
    const { schedule, startHour, endHour } = useMemo(() => {
        const dayGroups = {};
        DAYS.forEach(d => { dayGroups[d] = []; });

        let minH = 24, maxH = 0;

        (classes || []).forEach(cls => {
            const day = cls.day;
            if (!DAYS.includes(day)) return;

            // "14:30-17:29" → startMin, endMin
            const timeParts = (cls.time || '').match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
            if (!timeParts) return;

            const startMin = parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
            const endMin = parseInt(timeParts[3]) * 60 + parseInt(timeParts[4]);
            const startH = parseInt(timeParts[1]);
            const endH = parseInt(timeParts[3]);

            if (startH < minH) minH = startH;
            if (endH + 1 > maxH) maxH = endH + 1;

            dayGroups[day].push({
                ...cls,
                startMin,
                endMin,
                color: colorMap[cls.code] || COURSE_COLORS[0]
            });
        });

        // ders yoksa varsayılan 8-18
        if (minH >= maxH) { minH = 8; maxH = 18; }

        return { schedule: dayGroups, startHour: minH, endHour: maxH };
    }, [classes, colorMap]);

    const totalHours = endHour - startHour;
    const dayColWidth = (SCREEN_WIDTH - TIME_COL_WIDTH - 20) / DAYS.length; // 20 = padding

    // Şu anki zamanı gösteren yatay çizgi
    const now = new Date();
    const currentDay = now.toLocaleDateString('tr-TR', { weekday: 'long' });
    // İlk harf büyük yap
    const currentDayFormatted = currentDay.charAt(0).toUpperCase() + currentDay.slice(1);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMin = currentHour * 60 + currentMinute;
    const showNowLine = currentHour >= startHour && currentHour < endHour;
    const nowLineTop = ((currentTotalMin - startHour * 60) / 60) * HOUR_HEIGHT;

    // Bugünün indeksi
    const todayIdx = DAYS.indexOf(currentDayFormatted);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Ders Programı</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Grid */}
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.gridContainer}>
                    {/* Day Headers */}
                    <View style={styles.dayHeaderRow}>
                        <View style={{ width: TIME_COL_WIDTH }} />
                        {DAYS.map((day, idx) => (
                            <View
                                key={day}
                                style={[
                                    styles.dayHeader,
                                    { width: dayColWidth },
                                    idx === todayIdx && styles.dayHeaderToday
                                ]}
                            >
                                <Text style={[
                                    styles.dayHeaderText,
                                    idx === todayIdx && { color: colors.accent, fontWeight: 'bold' }
                                ]}>
                                    {day.substring(0, 3)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Time Grid */}
                    <View style={{ flexDirection: 'row' }}>
                        {/* Time labels */}
                        <View style={{ width: TIME_COL_WIDTH }}>
                            {Array.from({ length: totalHours }, (_, i) => (
                                <View key={i} style={[styles.timeSlot, { height: HOUR_HEIGHT }]}>
                                    <Text style={styles.timeText}>
                                        {String(startHour + i).padStart(2, '0')}:00
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Day columns */}
                        {DAYS.map((day, dayIdx) => (
                            <View
                                key={day}
                                style={[
                                    styles.dayColumn,
                                    { width: dayColWidth, height: totalHours * HOUR_HEIGHT },
                                    dayIdx === todayIdx && styles.dayColumnToday
                                ]}
                            >
                                {/* Hour grid lines */}
                                {Array.from({ length: totalHours }, (_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.hourLine,
                                            { top: i * HOUR_HEIGHT }
                                        ]}
                                    />
                                ))}

                                {/* Class blocks */}
                                {(schedule[day] || []).map((cls, idx) => {
                                    const top = ((cls.startMin - startHour * 60) / 60) * HOUR_HEIGHT;
                                    const height = ((cls.endMin - cls.startMin) / 60) * HOUR_HEIGHT;
                                    const isActive = currentDayFormatted === day &&
                                        currentTotalMin >= cls.startMin && currentTotalMin <= cls.endMin;

                                    return (
                                        <TouchableOpacity
                                            key={`${cls.crn}-${idx}`}
                                            style={[
                                                styles.classBlock,
                                                {
                                                    top,
                                                    height: Math.max(height - 2, 20),
                                                    backgroundColor: cls.color.bg,
                                                    borderLeftColor: cls.color.border,
                                                },
                                                isActive && {
                                                    borderLeftColor: colors.success,
                                                    borderLeftWidth: 4,
                                                }
                                            ]}
                                            activeOpacity={0.7}
                                            onPress={() => setSelectedClass(
                                                selectedClass?.crn === cls.crn && selectedClass?.day === cls.day
                                                    ? null : cls
                                            )}
                                        >
                                            <Text
                                                style={[styles.classBlockCode, { color: cls.color.text }]}
                                                numberOfLines={1}
                                            >
                                                {cls.code}
                                            </Text>
                                            {height > 40 && (
                                                <Text style={styles.classBlockTime} numberOfLines={1}>
                                                    {cls.time}
                                                </Text>
                                            )}
                                            {height > 60 && cls.room !== '-' && (
                                                <Text style={styles.classBlockRoom} numberOfLines={1}>
                                                    {cls.room}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}

                                {/* Now indicator */}
                                {showNowLine && dayIdx === todayIdx && (
                                    <View style={[styles.nowLine, { top: nowLineTop }]}>
                                        <View style={styles.nowDot} />
                                        <View style={styles.nowLineBar} />
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Selected class detail card */}
                {selectedClass && (
                    <View style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                            <View style={[
                                styles.detailColorDot,
                                { backgroundColor: (colorMap[selectedClass.code] || COURSE_COLORS[0]).border }
                            ]} />
                            <Text style={styles.detailCode}>{selectedClass.code}</Text>
                            <TouchableOpacity onPress={() => setSelectedClass(null)}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.detailName}>{selectedClass.name}</Text>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.muted} />
                            <Text style={styles.detailText}>
                                {selectedClass.day} {selectedClass.time}
                            </Text>
                        </View>
                        {selectedClass.loc !== '-' && (
                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="map-marker" size={14} color={colors.muted} />
                                <Text style={styles.detailText}>{selectedClass.loc}</Text>
                            </View>
                        )}
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="identifier" size={14} color={colors.muted} />
                            <Text style={styles.detailText}>CRN: {selectedClass.crn}</Text>
                        </View>
                    </View>
                )}

                {/* Legend */}
                <View style={styles.legend}>
                    {Object.entries(colorMap).map(([code, color]) => (
                        <View key={code} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: color.border }]} />
                            <Text style={styles.legendText}>{code}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    headerCenter: { flex: 1, marginHorizontal: 12, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },

    scrollView: { flex: 1 },
    gridContainer: { paddingHorizontal: 10, paddingTop: 10 },

    // Day Headers
    dayHeaderRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    dayHeader: {
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 8,
    },
    dayHeaderToday: {
        backgroundColor: 'rgba(41, 121, 255, 0.15)',
    },
    dayHeaderText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },

    // Time column
    timeSlot: {
        justifyContent: 'flex-start',
        paddingRight: 6,
    },
    timeText: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'right',
        marginTop: -6,
    },

    // Day columns
    dayColumn: {
        position: 'relative',
        borderLeftWidth: 0.5,
        borderLeftColor: 'rgba(255,255,255,0.06)',
    },
    dayColumnToday: {
        backgroundColor: 'rgba(41, 121, 255, 0.04)',
    },
    hourLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 0.5,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },

    // Class blocks
    classBlock: {
        position: 'absolute',
        left: 2,
        right: 2,
        borderRadius: 6,
        borderLeftWidth: 3,
        paddingHorizontal: 4,
        paddingVertical: 3,
        overflow: 'hidden',
    },
    classBlockCode: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.3,
    },
    classBlockTime: {
        fontSize: 8,
        color: colors.muted,
        marginTop: 1,
    },
    classBlockRoom: {
        fontSize: 8,
        color: colors.textSecondary,
        marginTop: 1,
    },

    // Now line
    nowLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    nowDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF5252',
        marginLeft: -4,
    },
    nowLineBar: {
        flex: 1,
        height: 1.5,
        backgroundColor: '#FF5252',
    },

    // Detail Card
    detailCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 10,
        marginTop: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailColorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    detailCode: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    detailName: {
        color: colors.textSecondary,
        fontSize: 14,
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    detailText: {
        color: colors.muted,
        fontSize: 13,
    },

    // Legend
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
        marginTop: 16,
        gap: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.card,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
});
