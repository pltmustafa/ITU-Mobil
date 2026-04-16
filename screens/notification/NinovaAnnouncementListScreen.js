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

const CACHE_KEY_ANNOUNCEMENTS_PREFIX = 'ninova_announcements_';

const parseDate = (d) => {
    if (!d) return '';
    try {
        let date;
        if (typeof d === 'string' && d.includes('/Date(')) {
            const num = parseInt(d.replace(/[^0-9]/g, ''), 10);
            date = new Date(num);
        } else {
            date = new Date(d);
        }
        if (isNaN(date.getTime())) return d;
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return d; }
};

export default function NinovaAnnouncementListScreen({ route, navigation }) {
    const { dersId, sinifId, title } = route.params;
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        const cacheKey = `${CACHE_KEY_ANNOUNCEMENTS_PREFIX}${dersId}_${sinifId}`;

        // Cache'den yukle
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.length > 0) {
                    setAnnouncements(parsed);
                    setLoading(false);
                }
            }
        } catch (e) { }

        // API'den guncelle
        try {
            const list = await ninovaApi.getNinovaAnnouncements(dersId, sinifId);
            setAnnouncements(list);
            if (list?.length > 0) {
                await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
            }
        } catch (error) {
            console.error('[NinovaAnnouncementList] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAnnouncement = (ann) => {
        navigation.navigate('NotificationDetail', {
            notification: {
                Title: ann.DuyuruBaslik,
                CreateDate: parseDate(ann.DuyuruTarihi),
                BodyText: ann.DuyuruAciklama,
                SummaryText: ann.YetkiliAdSoyad ? `${ann.DersKodu} - ${ann.YetkiliAdSoyad}` : ann.DersKodu,
            }
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading && announcements.length === 0 ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Duyurular yukleniyor...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {announcements.length > 0 ? (
                        announcements.map((ann, idx) => (
                            <TouchableOpacity
                                key={ann.DuyuruId || idx}
                                style={styles.card}
                                onPress={() => openAnnouncement(ann)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconWrap}>
                                    <MaterialCommunityIcons name="bullhorn-variant-outline" size={20} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle} numberOfLines={2}>{ann.DuyuruBaslik}</Text>
                                    <View style={styles.meta}>
                                        <Text style={styles.date}>{parseDate(ann.DuyuruTarihi)}</Text>
                                        {ann.YetkiliAdSoyad ? (
                                            <Text style={styles.author}>{ann.YetkiliAdSoyad}</Text>
                                        ) : null}
                                    </View>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="bullhorn-outline" size={64} color={colors.muted} />
                            <Text style={styles.emptyText}>Bu ders icin duyuru bulunamadi</Text>
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
    headerCenter: { flex: 1, marginHorizontal: 12, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card, borderRadius: 16,
        padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: colors.border
    },
    iconWrap: {
        width: 40, height: 40, borderRadius: 10,
        backgroundColor: `${colors.accent}15`,
        alignItems: 'center', justifyContent: 'center', marginRight: 12
    },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    date: { color: colors.muted, fontSize: 11 },
    author: { color: colors.muted, fontSize: 11 },
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: colors.muted, fontSize: 16, marginTop: 16 }
});
