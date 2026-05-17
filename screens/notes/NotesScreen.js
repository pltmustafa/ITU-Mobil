import { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ScrollView, TextInput, Linking,
    ActivityIndicator, Platform, StatusBar,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import noteHelper from '../../services/noteHelper';
import { useToast } from '../../components/common/Toast';

export default function NotesScreen({ navigation }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const { showToast, ToastComponent } = useToast();

    useEffect(() => {
        if (query.length < 2) { setResults([]); return; }
        const timer = setTimeout(() => handleSearch(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = async (q) => {
        setLoading(true);
        try {
            const data = await noteHelper.searchNotes(q);
            setResults(data || []);
        } catch (err) {
            setResults([]);
            showToast('Notlar yüklenemedi', 'error');
        } finally { setLoading(false); }
    };

    const openLink = (url) => { if (url) Linking.openURL(url).catch(() => { }); };

    const getSourceColor = (source) => source === 'ITUKovan' ? colors.success : '#fb923c';

    const getFileIcon = (title) => {
        const lower = title?.toLowerCase() || '';
        if (lower.includes('final') || lower.includes('vize')) return 'file-document-edit-outline';
        if (lower.includes('ödev') || lower.includes('homework')) return 'clipboard-text-outline';
        if (lower.includes('quiz') || lower.includes('kısa')) return 'help-circle-outline';
        return 'file-document-outline';
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
                    <MaterialCommunityIcons name="notebook-outline" size={24} color={colors.accent} />
                    <Text style={styles.title}>Ders Notları</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Ders kodu ara (örn: MAT103)"
                    placeholderTextColor={colors.muted}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
                {loading && <ActivityIndicator style={styles.searchLoader} color={colors.accent} />}
            </View>

            {/* Results */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {query.length < 2 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="text-search" size={64} color={colors.muted} />
                        <Text style={styles.emptyText}>Arama yapmak için ders kodu girin</Text>
                        <Text style={styles.emptyHint}>En az 2 karakter</Text>
                    </View>
                ) : results.length === 0 && !loading ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="file-search-outline" size={64} color={colors.muted} />
                        <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                    </View>
                ) : (
                    results.map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={styles.resultCard}
                            onPress={() => openLink(item.downloadLink)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconWrap, { backgroundColor: `${getSourceColor(item.source)}20` }]}>
                                <MaterialCommunityIcons name={getFileIcon(item.title)} size={24} color={getSourceColor(item.source)} />
                            </View>
                            <View style={styles.resultContent}>
                                <View style={styles.resultHeader}>
                                    <Text style={styles.courseCode}>{item.courseCode}</Text>
                                </View>
                                <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
                            </View>
                            <MaterialCommunityIcons name="download" size={20} color={colors.accent} />
                        </TouchableOpacity>
                    ))
                )}
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
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text, textShadowColor: colors.accentGlow, textShadowRadius: 8 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        margin: 16, backgroundColor: colors.card,
        borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 16 },
    searchLoader: { marginLeft: 10 },
    statusBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 10, backgroundColor: 'rgba(41, 121, 255, 0.1)',
        marginHorizontal: 16, borderRadius: 10, marginBottom: 8
    },
    statusText: { color: colors.accent, fontSize: 13 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyText: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 16 },
    emptyHint: { color: colors.muted, fontSize: 13, marginTop: 6 },
    resultCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        borderRadius: 14, padding: 14, marginBottom: 12,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 3
    },
    iconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    resultContent: { flex: 1, marginRight: 10 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    courseCode: { color: colors.accent, fontWeight: 'bold', fontSize: 15 },
    sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    sourceText: { fontSize: 10, fontWeight: '700' },
    noteTitle: { color: colors.text, fontSize: 14, lineHeight: 20 }
});
