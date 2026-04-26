import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useObsStore } from '../../../store/useObsStore';

export default function GraduationWidget({ earnedCredits, requiredCredits = 132, compact = false }) {
    const [localEarned, setLocalEarned] = useState(earnedCredits || 0);
    const [localRequired, setLocalRequired] = useState(requiredCredits || 132);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (earnedCredits) {
            setLocalEarned(earnedCredits);
            setLocalRequired(requiredCredits);
        } else {
            calculateFromCache();
        }
    }, [earnedCredits, requiredCredits]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await calculateFromCache();
        setIsRefreshing(false);
    };

    const calculateFromCache = async () => {
        try {
            const planStr = await AsyncStorage.getItem('obs_course_plan_v3');
            const termsStr = await AsyncStorage.getItem('obs_terms_cache_v3');
            if (!planStr || !termsStr) return;

            const planCoursesDb = JSON.parse(planStr);
            const terms = JSON.parse(termsStr);
            
            const userGrades = {};
            let isCurrentTerm = true;
            for (const term of terms) {
                if (!term.courses) {
                    isCurrentTerm = false;
                    continue;
                }
                for (const c of term.courses) {
                    const nameParts = c.name ? c.name.split(' - ') : [];
                    let code = nameParts[0] ? nameParts[0].trim() : c.code;
                    if (!code) continue;

                    let letter = c.harfNotu || c.basariNotu || null;

                    if (c.sinifId) {
                        try {
                            const gStr = await AsyncStorage.getItem(`obs_grades_${c.sinifId}`);
                            if (gStr) {
                                const gradeObj = JSON.parse(gStr);
                                if (gradeObj.harfNotu && gradeObj.harfNotu !== '-') {
                                    letter = gradeObj.harfNotu;
                                }
                            }
                        } catch (err) {}
                    }

                    if (letter && letter !== '-') {
                        userGrades[code] = letter;
                    } else if (!isCurrentTerm) {
                        if (!userGrades[code]) {
                            userGrades[code] = 'Geçti'; 
                        }
                    } else if (isCurrentTerm) {
                        if (!userGrades[code]) {
                            userGrades[code] = 'Devam'; 
                        }
                    }
                }
                isCurrentTerm = false;
            }

            let totalEarned = 0;
            let requiredTotal = 0;

            Object.keys(planCoursesDb).forEach(code => {
                const pc = planCoursesDb[code];
                let isMet = false;

                if (!code.startsWith('ELECTIVE_')) {
                    const grade = userGrades[code];
                    isMet = grade && !['FF', 'VF', 'BZ', 'Devam'].includes(grade);
                }

                requiredTotal += pc.kredisi;
                if (isMet) {
                    totalEarned += pc.kredisi;
                }
            });

            Object.keys(userGrades).forEach(code => {
                if (!planCoursesDb[code]) {
                    const grade = userGrades[code];
                    const isMet = grade && !['FF', 'VF', 'BZ', 'Devam'].includes(grade);
                    if (isMet) {
                        totalEarned += 3;
                    }
                }
            });

            setLocalEarned(totalEarned);
            setLocalRequired(requiredTotal);
            
            // Sonucu store'a da gönder ki diğer bileşenler de kullansın
            const obsStore = useObsStore.getState();
            if (obsStore.setGraduationData) {
                obsStore.setGraduationData({
                    metKrediTotal: totalEarned,
                    gerekliMezuniyetKredisi: requiredTotal
                });
            }

        } catch (e) {
            console.error('[GraduationWidget] Cache hesaplama hatası:', e);
        }
    };

    const percent = Math.min(100, Math.round((localEarned / localRequired) * 100)) || 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconContainer} onPress={handleRefresh} disabled={isRefreshing} activeOpacity={0.6}>
                    {isRefreshing ? (
                        <ActivityIndicator size={16} color={colors.accent} />
                    ) : (
                        <MaterialCommunityIcons name="school-outline" size={20} color={colors.accent} />
                    )}
                </TouchableOpacity>
                <Text style={styles.title}>{compact ? 'MEZUNİYET' : 'MEZUNİYET DURUMU'}</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>

                <View style={[styles.meta, compact && { flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                    <Text style={styles.percentText}>%{percent} Tamamlandı</Text>
                    <Text style={styles.creditText}>{localEarned} / {localRequired} Kr</Text>
                </View>
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
        flex: 1
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
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
    content: {
        gap: 10,
    },
    progressBg: {
        height: 12,
        backgroundColor: colors.cardHover,
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.success,
        borderRadius: 6,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    percentText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 14,
    },
    creditText: {
        color: colors.muted,
        fontSize: 12,
    }
});
