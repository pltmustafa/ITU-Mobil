import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, PanResponder } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useObsStore } from '../../../store/useObsStore';

export default function FoodMenuWidget({ mealType = 'ogle', onToggleMeal, onRefresh, refreshing }) {
    const [selectedDateIndex, setSelectedDateIndex] = useState(0);
    const selectedIndexRef = useRef(selectedDateIndex);

    // Store'daki cache'i kullan — tüm veriler buradan okunur
    const foodMenuCache = useObsStore(state => state.foodMenuCache);

    const getFormattedDate = (date) => {
        const options = { day: 'numeric', month: 'long', weekday: 'long' };
        return date.toLocaleDateString('tr-TR', options);
    };

    useEffect(() => {
        selectedIndexRef.current = selectedDateIndex;
        // Swipe yapıldığında eksik veriyi çek (yalnızca o anki tarih için)
        useObsStore.getState().ensureFoodMenuCacheForOffset(selectedDateIndex);
    }, [selectedDateIndex]);

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + selectedDateIndex);

    const headerTitle = selectedDateIndex === 0
        ? (mealType === 'ogle' ? 'ÖĞLE MENÜSÜ' : 'AKŞAM MENÜSÜ')
        : `${getFormattedDate(targetDate).toUpperCase()} - ${mealType === 'ogle' ? 'ÖĞLE' : 'AKŞAM'}`;

    const dateStr = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
    const cacheKey = `${dateStr}_${mealType}`;

    const panResponder = useMemo(() => PanResponder.create({
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
                    setSelectedDateIndex(currentIndex - 1);
                }
            } else if (gestureState.dx < -40) {
                if (currentIndex < 6) {
                    setSelectedDateIndex(currentIndex + 1);
                }
            }
        }
    }), []);

    // Menü verisi — hep cache'den
    const currentData = foodMenuCache[cacheKey];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                        {refreshing ? (
                            <ActivityIndicator size={16} color={colors.accent} />
                        ) : (
                            <MaterialCommunityIcons name="food-variant" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.title}>{headerTitle}</Text>
                </View>

            </View>

            <View {...panResponder.panHandlers} style={[styles.content, { width: '100%' }]}>
                <View style={styles.menuInfo}>
                    {!currentData ? (
                        <Text style={styles.mainDish}>Menü Yükleniyor...</Text>
                    ) : currentData?.FoodList?.length > 0 ? (
                        <>
                            {currentData.FoodList.map((food, idx) => (
                                <Text key={idx} style={styles.mainDish} numberOfLines={1}>
                                    • {food.FoodName}
                                </Text>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.subDish}>Menü bulunamadı</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.toggleBtn} onPress={() => { onToggleMeal(); }} activeOpacity={0.6}>
                    <MaterialCommunityIcons
                        name={mealType === 'ogle' ? 'weather-sunset-down' : 'weather-sunny'}
                        size={20}
                        color={colors.accent}
                    />
                    <Text style={styles.toggleText}>{mealType === 'ogle' ? 'Akşam' : 'Öğle'}</Text>
                </TouchableOpacity>
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
        flex: 1,
        paddingRight: 10,
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
        flex: 1,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuInfo: {
        flex: 1,
        marginRight: 10,
    },
    calorieText: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: 'bold',
    },
    mainDish: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    subDish: {
        color: colors.text,
        fontSize: 12,
        marginBottom: 8,
    },
    toggleBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardHover,
        borderRadius: 12,
        padding: 10,
        gap: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    toggleText: {
        color: colors.accent,
        fontSize: 10,
        fontWeight: 'bold',
    },
});
