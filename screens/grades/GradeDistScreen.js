import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity, TextInput,
    ScrollView, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import gradeHelper from '../../services/gradeHelper';
import { useToast } from '../../components/common/Toast';

const BAR_BG = 'rgba(41, 121, 255, 0.08)';

export default function GradeDistScreen({ navigation }) {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef(null);
    const { showToast, ToastComponent } = useToast();


    const doSearch = useCallback(async (q) => {
        const term = (q || query).trim();
        if (!term) return;
        const normalized = term.replace(/İ/g, 'I').replace(/ı/g, 'I').replace(/i/g, 'I').toUpperCase();
        setSearching(true);
        try {
            // Statik branş dosyaları üzerinden arama yapıyoruz
            const results = await gradeHelper.searchCourses(normalized);
            setSearchResults(results || []);
        } catch (e) {
            setSearchResults([]);
            showToast('Branş verisi alınamadı', 'error');
        }
        setSearching(false);
    }, [query]);

    // 3+ karakter sonrası 300ms debounce ile otomatik arama
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length >= 3) {
            debounceRef.current = setTimeout(() => doSearch(query), 300);
        }
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const selectCourse = (course) => {
        navigation.navigate('GradeDetail', { course });
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
                    <MaterialCommunityIcons name="chart-bar" size={22} color={colors.accent} />
                    <Text style={styles.title}>Not Dağılımı</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Ders ara (ör: MAT 103)"
                    placeholderTextColor={colors.muted}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={doSearch}
                    returnKeyType="search"
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); setSearchResults(null); }}>
                        <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Searching */}
                {searching && (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                )}

                {/* Search Results */}
                {searchResults && !searching && (
                    <>
                        <Text style={styles.sectionTitle}>
                            {searchResults.length} ders bulundu
                        </Text>
                        {searchResults.map((course) => (
                            <TouchableOpacity
                                key={`${course.bransKodu}-${course.dersNo}`}
                                style={styles.courseItem}
                                onPress={() => selectCourse(course)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.courseIcon}>
                                    <MaterialCommunityIcons name="book-outline" size={20} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.courseCode}>{course.tamKod}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                            </TouchableOpacity>
                        ))}
                    </>
                )}

                {/* Empty State */}
                {!searching && !searchResults && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <MaterialCommunityIcons name="chart-bar" size={48} color={colors.accent} />
                        </View>
                        <Text style={styles.emptyTitle}>Not Dağılımı</Text>
                        <Text style={styles.emptyDesc}>
                            Ders kodu veya branş adı yazarak{'\n'}geçmiş dönem not istatistiklerini görüntüle
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },

    // Header
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

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 16, marginVertical: 12,
        backgroundColor: colors.card, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
        borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 16 },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    center: { alignItems: 'center', paddingTop: 60 },

    // Section
    sectionTitle: {
        fontSize: 13, fontWeight: '600', color: colors.muted,
        marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
    },

    // Course List
    courseItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    courseIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: BAR_BG,
        alignItems: 'center', justifyContent: 'center',
    },
    courseCode: { color: colors.text, fontSize: 16, fontWeight: '600' },

    // Empty State
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyIconWrap: {
        width: 88, height: 88, borderRadius: 24,
        backgroundColor: BAR_BG,
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
    emptyDesc: { color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
