import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Platform,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import roomHelper from '../../services/roomHelper';
import { useToast } from '../../components/common/Toast';

const POPULAR_BUILDINGS = ['MED', 'FEB', 'INB', 'EEB', 'MKB', 'KMB', 'UUB', 'MDB'];

export default function RoomsScreen({ navigation }) {
    const [building, setBuilding] = useState('');
    const [fullDay, setFullDay] = useState([]);
    const [limited, setLimited] = useState({});
    const [willBeEmpty, setWillBeEmpty] = useState({});
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const { showToast, ToastComponent } = useToast();

    const searchRooms = async (code) => {
        const searchCode = code || building;
        if (!searchCode.trim()) return;

        // Saat 19:00'dan sonra fakülteler kapalı
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0=Pazar, 6=Cumartesi
        if (hour >= 19 || day === 0 || day === 6) {
            setFullDay([]);
            setLimited({});
            setSearched(true);
            return;
        }

        setLoading(true);
        setSearched(true);
        try {
            // Artık sunucuya sormuyoruz, lokal helper ile JSON'dan hesaplıyoruz
            const data = await roomHelper.getEmptyRooms(searchCode);
            setFullDay(data.full_day || []);
            setLimited(data.limited || {});
            setWillBeEmpty(data.will_be_empty || {});
        } catch (err) {
            setFullDay([]);
            setLimited({});
            setWillBeEmpty({});
            showToast('Veriler alınamadı veya hesaplanamadı', 'error');
        } finally { setLoading(false); }
    };

    const limitedRooms = [];
    Object.entries(limited).forEach(([time, rooms]) => {
        if (Array.isArray(rooms)) {
            rooms.forEach(r => limitedRooms.push([r, time]));
        } else if (typeof rooms === 'string') {
            limitedRooms.push([time, rooms]);
        }
    });
    // Önce saate, sonra oda adına göre sırala
    limitedRooms.sort((a, b) => {
        if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
        return a[0].localeCompare(b[0]);
    });

    const willEmptyRooms = [];
    Object.entries(willBeEmpty).forEach(([time, rooms]) => {
        if (Array.isArray(rooms)) {
            rooms.forEach(item => willEmptyRooms.push([item.room, time, item.duration]));
        }
    });
    willEmptyRooms.sort((a, b) => {
        if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
        return a[0].localeCompare(b[0]);
    });

    const totalRooms = fullDay.length + limitedRooms.length + willEmptyRooms.length;

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
                    <MaterialCommunityIcons name="door-open" size={24} color={colors.accent} />
                    <Text style={styles.title}>Boş Sınıflar</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Search */}
                <View style={styles.searchRow}>
                    <View style={styles.inputContainer}>
                        <MaterialCommunityIcons name="office-building-outline" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Bina Kodu (örn: MED)"
                            placeholderTextColor={colors.muted}
                            value={building}
                            onChangeText={setBuilding}
                            autoCapitalize="characters"
                            onSubmitEditing={() => searchRooms()}
                        />
                    </View>
                    <TouchableOpacity style={styles.searchBtn} onPress={() => searchRooms()}>
                        <MaterialCommunityIcons name="magnify" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Quick Tags */}
                <View style={styles.tagsRow}>
                    {POPULAR_BUILDINGS.map((b) => (
                        <TouchableOpacity
                            key={b}
                            style={[styles.tag, building === b && styles.tagActive]}
                            onPress={() => { setBuilding(b); searchRooms(b); }}
                        >
                            <Text style={[styles.tagText, building === b && styles.tagTextActive]}>{b}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Results */}
                {loading ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={styles.loadingText}>Aranıyor...</Text>
                    </View>
                ) : searched ? (
                    totalRooms > 0 ? (
                        <View style={styles.resultContainer}>
                            {/* Tam Gün Boş */}
                            {fullDay.length > 0 && (
                                <View style={styles.resultCard}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                                        <Text style={styles.sectionTitle}>Tam Gün Boş</Text>
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countText}>{fullDay.length}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.roomsGrid}>
                                        {fullDay.map((room, idx) => (
                                            <View key={idx} style={styles.roomChip}>
                                                <MaterialCommunityIcons name="door" size={16} color={colors.success} />
                                                <Text style={styles.roomName}>{room}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Kısmi Boş */}
                            {limitedRooms.length > 0 && (
                                <View style={styles.resultCard}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                                        <Text style={styles.sectionTitle}>Belli Saate Kadar Boş</Text>
                                        <View style={[styles.countBadge, { backgroundColor: 'rgba(250, 204, 21, 0.2)' }]}>
                                            <Text style={[styles.countText, { color: colors.warning }]}>{limitedRooms.length}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.limitedGrid}>
                                        {limitedRooms.map(([room, times], idx) => (
                                            <View key={idx} style={styles.limitedChip}>
                                                <View style={styles.timeBadge}>
                                                    <MaterialCommunityIcons name="clock-outline" size={12} color={colors.warning} />
                                                    <Text style={styles.timeText}>
                                                        {times}
                                                    </Text>
                                                </View>
                                                <Text style={styles.limitedRoomName}>{room}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Yakında Boşalacak */}
                            {willEmptyRooms.length > 0 && (
                                <View style={styles.resultCard}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
                                        <Text style={styles.sectionTitle}>Yakında Boşalacak</Text>
                                        <View style={[styles.countBadge, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}>
                                            <Text style={[styles.countText, { color: colors.accent }]}>{willEmptyRooms.length}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.limitedGrid}>
                                        {willEmptyRooms.map(([room, time, duration], idx) => (
                                            <View key={idx} style={styles.limitedChip}>
                                                <View style={[styles.timeBadge, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                                                    <MaterialCommunityIcons name="clock-check-outline" size={12} color={colors.accent} />
                                                    <Text style={[styles.timeText, { color: colors.accent }]}>
                                                        {time}
                                                    </Text>
                                                </View>
                                                <Text style={styles.limitedRoomName}>{room}</Text>
                                                <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4, fontWeight: '600' }}>
                                                    {duration} boş
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="door-closed-lock" size={64} color={colors.muted} />
                            <Text style={styles.emptyText}>Boş sınıf bulunamadı</Text>
                            <Text style={styles.emptyHint}>Farklı bir bina deneyin</Text>
                        </View>
                    )
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="office-building-marker-outline" size={64} color={colors.muted} />
                        <Text style={styles.emptyText}>Bina kodu girin veya seçin</Text>
                        <Text style={styles.emptyHint}>Yukarıdaki etiketlere dokunarak hızlı arama yapın</Text>
                    </View>
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
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    inputContainer: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
        borderRadius: 12, paddingHorizontal: 14
    },
    input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 16 },
    searchBtn: {
        backgroundColor: colors.accent, borderRadius: 12, width: 52, height: 52,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
    },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    tag: {
        backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 10, borderWidth: 1, borderColor: colors.border
    },
    tagActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    tagTextActive: { color: '#fff' },
    loadingState: { alignItems: 'center', marginTop: 60 },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },
    resultContainer: { gap: 16 },
    resultCard: {
        backgroundColor: colors.card, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: colors.border
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
    countBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8
    },
    countText: { color: colors.success, fontSize: 13, fontWeight: 'bold' },
    roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roomChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
    },
    roomName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    limitedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    limitedChip: {
        backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 10,
        alignItems: 'center', width: '31.5%'
    },
    timeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(250, 204, 21, 0.15)', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 6, marginBottom: 6
    },
    timeText: { color: colors.warning, fontSize: 11, fontWeight: 'bold' },
    limitedRoomName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 16 },
    emptyHint: { color: colors.muted, fontSize: 13, marginTop: 6, textAlign: 'center' }
});
