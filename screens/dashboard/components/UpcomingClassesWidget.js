import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, PanResponder, LayoutAnimation, Platform, UIManager } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function UpcomingClassesWidget({ classes, onRefresh, refreshing }) {
    const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
    const selectedIndexRef = React.useRef(selectedDateIndex);

    React.useEffect(() => {
        selectedIndexRef.current = selectedDateIndex;
    }, [selectedDateIndex]);

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const panResponder = React.useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
            return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (evt, gestureState) => {
            const currentIndex = selectedIndexRef.current;
            if (gestureState.dx > 40) {
                if (currentIndex > 0) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSelectedDateIndex(currentIndex - 1);
                }
            } else if (gestureState.dx < -40) {
                if (currentIndex < 6) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSelectedDateIndex(currentIndex + 1);
                }
            }
        }
    }), []);

    // Helper to get formatted date string (e.g. "23 Ekim Pazartesi")
    const getFormattedDate = (date) => {
        const options = { day: 'numeric', month: 'long', weekday: 'long' };
        return date.toLocaleDateString('tr-TR', options);
    };

    // Helper to get day name in English for filtering
    const getDayNameEn = (date) => {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    };

    const prevClassesRef = React.useRef(classes);
    React.useEffect(() => {
        if (prevClassesRef.current !== classes) {
            // Sadece önceden veri varsa animasyon yap (refresh durumu)
            // null/undefined → veri geçişinde (ilk yükleme) animasyon yapma
            if (prevClassesRef.current && prevClassesRef.current.length > 0) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
            prevClassesRef.current = classes;
        }
    }, [classes]);

    const processClasses = (dayClasses, isToday) => {
        if (!dayClasses) return [];

        const parseTime = (timeStr) => {
            if (!timeStr) return { start: 0, end: 0 };
            const times = timeStr.match(/\d{1,2}:\d{2}/g);
            if (!times || times.length < 2) return { start: 0, end: 0 };
            
            const [startH, startM] = times[0].split(':').map(Number);
            const [endH, endM] = times[1].split(':').map(Number);
            return { start: startH * 60 + startM, end: endH * 60 + endM };
        };

        // Sort classes by start time
        const sortedClasses = [...dayClasses].sort((a, b) => {
            return parseTime(a.time).start - parseTime(b.time).start;
        });

        // If not today, just return classes without status logic
        if (!isToday) {
            return sortedClasses.map(cls => ({ ...cls, status: 'future', message: '' }));
        }

        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();

        return sortedClasses.map(cls => {
            const { start, end } = parseTime(cls.time);
            let status = 'upcoming';
            let message = '';

            if (currentMin > end) status = 'ended';
            else if (currentMin >= start) {
                status = 'active';
            } else {
                const diff = start - currentMin;
                if (diff > 60) {
                    const h = Math.floor(diff / 60);
                    const m = diff % 60;
                    message = `${h}s ${m}dk kaldı`;
                } else {
                    message = `${diff} dk kaldı`;
                }
            }
            return { ...cls, status, message };
        }).filter(cls => cls.status !== 'ended');
    };

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + selectedDateIndex);

    const targetDayEn = getDayNameEn(targetDate);
    const targetDayTr = getFormattedDate(targetDate);

    const headerTitle = selectedDateIndex === 0 ? 'BUGÜN' : targetDayTr.toUpperCase();

    let displayClasses = [];
    if (classes && classes.length > 0) {
        const daysClasses = classes.filter(c => c.day_en === targetDayEn);
        displayClasses = processClasses(daysClasses, selectedDateIndex === 0);
    }

    const hasClasses = displayClasses.length > 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                        {refreshing ? (
                            <ActivityIndicator size={16} color={colors.accent} />
                        ) : (
                            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.title}>{headerTitle}</Text>
                </View>
            </View>

            <View {...panResponder.panHandlers} style={styles.swipeContent}>
                {hasClasses ? (
                    <View style={styles.list}>
                        {displayClasses.map((cls, idx) => (
                            <View key={idx} style={[styles.classItem, cls.status === 'active' && styles.activeItem]}>
                                <View style={styles.timeBox}>
                                    <Text style={[
                                        styles.timeText,
                                        cls.status === 'active' && { color: colors.success, marginTop: 12 }
                                    ]}>{cls.time}</Text>
                                    {cls.message ? (
                                        <Text style={[styles.statusText, cls.status === 'active' && { color: colors.success }]}>
                                            {cls.message}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.classInfo}>
                                    <Text style={styles.classCode}>{cls.code} - {cls.name}</Text>
                                    <View style={styles.locRow}>
                                        <MaterialCommunityIcons name="map-marker" size={12} color={colors.muted} />
                                        <Text style={styles.locText}>{cls.loc?.replace(/^Ayazağa,\s*/i, '')}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            {selectedDateIndex === 0 ? "Bugün kalan dersiniz yok." : "Bu güne ait ders kaydı yok."}
                        </Text>
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
    swipeContent: {
        width: '100%',
    },
    iconContainer: {
        backgroundColor: colors.cardHover,
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
    list: {
        gap: 12,
    },
    classItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardHover,
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    activeItem: {
        borderLeftColor: colors.success,
        backgroundColor: 'rgba(76, 175, 80, 0.1)'
    },
    timeBox: {
        marginRight: 12,
        paddingRight: 12,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70
    },
    timeText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 2
    },
    statusText: {
        color: colors.accent,
        fontSize: 10,
        fontWeight: '600'
    },
    classInfo: {
        flex: 1,
    },
    classCode: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 2,
    },
    locRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locText: {
        color: colors.muted,
        fontSize: 11,
        marginLeft: 2,
    },
    emptyState: {
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7
    },
    emptyText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2
    },
    emptySubtext: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: 'bold'
    }
});
