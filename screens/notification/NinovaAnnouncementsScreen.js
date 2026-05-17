import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import ninovaApi from '../../services/ninovaApi';

const CACHE_KEY_COURSES = 'ninova_courses_cache_v1';

export default function NinovaAnnouncementsScreen({ navigation }) {
    const [courses, setCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY_COURSES);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.length > 0) {
                    setCourses(parsed);
                    setLoadingCourses(false);
                    return;
                }
            }
        } catch (e) { }

        try {
            const list = await ninovaApi.getNinovaCourses();
            if (list?.length > 0) {
                setCourses(list);
                await AsyncStorage.setItem(CACHE_KEY_COURSES, JSON.stringify(list));
            }
        } catch (error) {
            console.error('[NinovaAnnouncements] Courses error:', error);
        } finally {
            setLoadingCourses(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="bullhorn-outline" size={22} color={colors.accent} />
                    <Text style={styles.headerTitle}>Sınıf Duyuruları</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loadingCourses ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Dersler yukleniyor...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {courses.length > 0 ? (
                        courses.map((course, idx) => (
                            <TouchableOpacity
                                key={`${course.SinifId}-${idx}`}
                                style={styles.courseCard}
                                onPress={() => navigation.navigate('NinovaAnnouncementList', {
                                    dersId: course.DersId,
                                    sinifId: course.SinifId,
                                    title: course.SinifAdi,
                                })}
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
                            <Text style={styles.emptyText}>Ninova dersi bulunamadi</Text>
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
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
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
    emptyText: { color: colors.muted, fontSize: 16, marginTop: 16 }
});
