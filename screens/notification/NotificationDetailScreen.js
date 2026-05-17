import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity,
    Platform, StatusBar, Linking, TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ninovaApi from '../../services/ninovaApi';
import { useObsStore } from '../../store/useObsStore';

export default function NotificationDetailScreen({ route, navigation }) {
    const { notification } = route.params;
    const isNinova = notification.ApplicationName === 'Ninova' && !!notification.KeyValues;
    const [ninovaDetail, setNinovaDetail] = useState(null);
    const [loadingNinova, setLoadingNinova] = useState(false);

    useEffect(() => {
        if (isNinova) {
            // Önce cache'e bak
            const cached = useObsStore.getState().notificationDetails[notification.KeyValues];
            if (cached) {
                setNinovaDetail(cached);
                return;
            }

            setLoadingNinova(true);
            ninovaApi.getNinovaDetail(notification.KeyValues)
                .then(detail => {
                    if (detail) {
                        setNinovaDetail(detail);
                        // Store'a da ekle
                        useObsStore.setState(state => ({
                            notificationDetails: { ...state.notificationDetails, [notification.KeyValues]: detail }
                        }));
                    } else {
                        setNinovaDetail({ error: 'İçerik bulunamadı.' });
                    }
                })
                .catch(err => {
                    console.error('Ninova detail err', err);
                    setNinovaDetail({ error: 'İçerik yüklenirken hata oluştu.' });
                })
                .finally(() => {
                    setLoadingNinova(false);
                });
        }
    }, []);

    const cleanContent = (text) => {
        if (!text) return '';
        let cleaned = text;

        // 1. Remove Head/Style/Script
        cleaned = cleaned.replace(/<head>[\s\S]*?<\/head>/gi, '');
        cleaned = cleaned.replace(/<style>[\s\S]*?<\/style>/gi, '');
        cleaned = cleaned.replace(/<script>[\s\S]*?<\/script>/gi, '');

        // 2. Replace BR/P with newlines
        cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
        cleaned = cleaned.replace(/<\/p>/gi, '\n\n');
        cleaned = cleaned.replace(/<\/div>/gi, '\n');

        // 3. Remove all other tags
        cleaned = cleaned.replace(/<[^>]+>/g, '');

        // 4. Decode HTML Entities (Common Turkish & Standard)
        const entities = {
            '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
            '&uuml;': 'ü', '&Uuml;': 'Ü', '&ouml;': 'ö', '&Ouml;': 'Ö',
            '&ccedil;': 'ç', '&Ccedil;': 'Ç', '&Idot;': 'İ', '&idot;': 'ı',
            '&Agrave;': 'À', '&Aacute;': 'Á', '&Acirc;': 'Â', '&Atilde;': 'Ã', '&Auml;': 'Ä', '&Aring;': 'Å',
            '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã', '&auml;': 'ä', '&aring;': 'å',
            '&Egrave;': 'È', '&Eacute;': 'É', '&Ecirc;': 'Ê', '&Euml;': 'Ë',
            '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê', '&euml;': 'ë',
            '&Igrave;': 'Ì', '&Iacute;': 'Í', '&Icirc;': 'Î', '&Iuml;': 'Ï',
            '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î', '&iuml;': 'ï',
            '&Ograve;': 'Ò', '&Oacute;': 'Ó', '&Ocirc;': 'Ô', '&Otilde;': 'Õ', '&Ouml;': 'Ö',
            '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ', '&ouml;': 'ö',
            '&Ugrave;': 'Ù', '&Uacute;': 'Ú', '&Ucirc;': 'Û', '&Uuml;': 'Ü',
            '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û', '&uuml;': 'ü',
            '&Yacute;': 'Ý', '&yacute;': 'ý', '&yuml;': 'ÿ',
            '&copy;': '©', '&reg;': '®', '&euro;': '€', '&pound;': '£', '&cent;': '¢', '&yen;': '¥',
            '&bull;': '•', '&ndash;': '–', '&mdash;': '—',
            '&lsquo;': '‘', '&rsquo;': '’', '&sbquo;': '‚', '&ldquo;': '“', '&rdquo;': '”', '&bdquo;': '„',
            '&dagger;': '†', '&Dagger;': '‡', '&permil;': '‰', '&lsaquo;': '‹', '&rsaquo;': '›',
            '&oline;': '‾', '&frasl;': '⁄',
            '&#39;': "'"
        };

        cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, (match) => entities[match] || match);

        // 5. Fazla satır atlamaları, sekme (tab) ve boşluk oluşan büyük blokları temizle
        cleaned = cleaned.replace(/[ \t]+\n/g, '\n'); // Satır sonlarındaki boşlukları al
        return cleaned.trim().replace(/(\r?\n[ \t]*){2,}/g, '\n\n'); // 2'den fazla ardışık satırı \n\n yap
    };



    let rawContent = (notification.KeyValues && notification.KeyValues.includes('<')) 
        ? notification.KeyValues 
        : (notification.BodyText || notification.ContentText || notification.SummaryText);

    if (isNinova && ninovaDetail) {
        if (ninovaDetail.error) {
            rawContent = ninovaDetail.error;
        } else {
            rawContent = ninovaDetail.DuyuruAciklama || ninovaDetail.OdevAciklama || ninovaDetail.Aciklama || rawContent;
        }
    }
    const contentText = cleanContent(rawContent);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>Bildirim Detayı</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.titleRow}>
                        <MaterialCommunityIcons name="bell-ring-outline" size={28} color={colors.accent} />
                        <Text style={styles.title} selectable={true}>{notification.Title || 'Başlıksız'}</Text>
                    </View>

                    <View style={styles.dateRow}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.muted} />
                        <Text style={styles.date}>{notification.CreateDate}</Text>
                    </View>

                    <View style={styles.divider} />

                    {loadingNinova ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={{ marginTop: 10, color: colors.muted }}>Ninova detayı yükleniyor...</Text>
                        </View>
                    ) : (
                        <TextInput
                            style={[styles.content, { padding: 0 }]} // TextInput defaults
                            value={contentText}
                            editable={false}
                            multiline={true}
                            scrollEnabled={false}
                            dataDetectorTypes="link" // iOS
                            autoLink="web" // Android
                            textAlignVertical="top"
                        />
                    )}
                </View>
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
    scrollContent: { padding: 16 },

    card: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    titleRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
        paddingRight: 10
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        lineHeight: 28
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 15
    },
    date: {
        color: colors.muted,
        fontSize: 13
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 15,
        opacity: 0.5
    },
    content: {
        color: colors.textSecondary,
        fontSize: 16,
        lineHeight: 26
    }
});
