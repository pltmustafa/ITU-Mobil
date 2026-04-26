import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ScrollView, Platform, StatusBar, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DEFAULT_MENU_ITEMS = [
    { id: 'courses', title: 'OBS', icon: 'book-education-outline', screen: 'Courses', color: colors.accent },
    { id: 'schedule', title: 'Ders Programı', icon: 'calendar-clock', screen: 'Schedule', color: '#eab308' },
    { id: 'gpa', title: 'GPA Simülatör', icon: 'calculator-variant', screen: 'GPASimulator', color: '#a78bfa' },
    { id: 'prereqs', title: 'Önşart', icon: 'transit-connection-variant', screen: 'Prerequisites', color: '#f87171' },
    { id: 'ninova', title: 'Ninova', icon: 'folder-open-outline', screen: 'Ninova', color: '#22d3ee' },
    { id: 'notes', title: 'Ders Notları', icon: 'notebook-outline', screen: 'Notes', color: '#f472b6' },
    { id: 'rooms', title: 'Boş Sınıflar', icon: 'door-open', screen: 'Rooms', color: colors.warning },
    { id: 'ring', title: 'Ring Takip', icon: 'bus', screen: 'Ring', color: '#fb923c' },
    { id: 'notifications', title: 'Bildirimler', icon: 'bell-outline', screen: 'Notifications', color: '#60a5fa' },
    { id: 'gradedist', title: 'Not Dağılımı', icon: 'chart-bar', screen: 'GradeDist', color: '#14b8a6' },
    { id: 'graduation', title: 'Mezuniyet', icon: 'school-outline', screen: 'Graduation', color: colors.success },
    { id: 'mail', title: 'Mail', icon: 'email-outline', screen: 'Mail', color: '#ef4444' },
];

const MENU_ORDER_KEY = 'menu_order_pref';
const MENU_HIDDEN_KEY = 'menu_hidden_pref';

export default function MenuScreen({ navigation }) {
    const [menuOrder, setMenuOrder] = useState(DEFAULT_MENU_ITEMS.map(i => i.id));
    const [hiddenItems, setHiddenItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [swapId, setSwapId] = useState(null);

    useEffect(() => {
        AsyncStorage.getItem(MENU_ORDER_KEY).then(stored => {
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure all items exist
                const validOrder = parsed.filter(id => DEFAULT_MENU_ITEMS.find(i => i.id === id));
                const missing = DEFAULT_MENU_ITEMS.filter(i => !validOrder.includes(i.id)).map(i => i.id);
                setMenuOrder([...validOrder, ...missing]);
            }
        });
        AsyncStorage.getItem(MENU_HIDDEN_KEY).then(stored => {
            if (stored) {
                setHiddenItems(JSON.parse(stored));
            }
        });
    }, []);


    const toggleVisibility = (id) => {
        let newHidden = [...hiddenItems];
        if (newHidden.includes(id)) {
            newHidden = newHidden.filter(i => i !== id);
        } else {
            newHidden.push(id);
        }
        setHiddenItems(newHidden);
        AsyncStorage.setItem(MENU_HIDDEN_KEY, JSON.stringify(newHidden));
    };

    const handleLongPress = () => {
        setIsEditing(true);
        setSwapId(null);
    };

    const handlePress = async (item) => {
        const isSoon = item.id === 'mail';

        if (isSoon) {
            Alert.alert("Çok Yakında", "Bu özellik çok yakında eklenecek!");
            return;
        }

        if (!isEditing) {
            navigation.navigate(item.screen);
            return;
        }

        if (swapId === null) {
            setSwapId(item.id);
        } else if (swapId === item.id) {
            setSwapId(null);
        } else {
            // Swap
            const newOrder = [...menuOrder];
            const idx1 = newOrder.indexOf(swapId);
            const idx2 = newOrder.indexOf(item.id);
            if (idx1 !== -1 && idx2 !== -1) {
                [newOrder[idx1], newOrder[idx2]] = [newOrder[idx2], newOrder[idx1]];
                setMenuOrder(newOrder);
                AsyncStorage.setItem(MENU_ORDER_KEY, JSON.stringify(newOrder));
            }
            setSwapId(null);
        }
    };

    const finishEditing = () => {
        setIsEditing(false);
        setSwapId(null);
    };

    const orderedItems = menuOrder.map(id => DEFAULT_MENU_ITEMS.find(i => i.id === id)).filter(Boolean);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Menü</Text>
                {isEditing ? (
                    <TouchableOpacity onPress={finishEditing} style={[styles.headerBtn, { backgroundColor: colors.success }]}>
                        <MaterialCommunityIcons name="check" size={22} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {isEditing && (
                <View style={styles.editHint}>
                    <MaterialCommunityIcons name="gesture-tap" size={16} color={colors.accent} />
                    <Text style={styles.editHintText}>Yer değiştirmek için iki öğeye dokun</Text>
                </View>
            )}

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.grid}>
                    {orderedItems.map((item) => {
                        const isHidden = hiddenItems.includes(item.id);
                        if (!isEditing && isHidden) return null;

                        const isSoon = item.id === 'mail';
                        const isSelected = swapId === item.id;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.menuCard,
                                    isSelected && styles.menuCardSelected,
                                    (isEditing && isHidden) && { opacity: 0.5, borderColor: colors.border + '80' },
                                    isSoon && { opacity: 0.5 }
                                ]}
                                onPress={() => handlePress(item)}
                                onLongPress={handleLongPress}
                                activeOpacity={0.7}
                                delayLongPress={400}
                            >
                                <View style={[styles.iconWrap, { backgroundColor: `${item.color}20` }]}>
                                    <MaterialCommunityIcons name={item.icon} size={28} color={item.color} />
                                </View>
                                <Text style={styles.menuTitle}>{item.title}</Text>

                                {isSoon && (
                                    <View style={styles.yakindaBadge}>
                                        <Text style={styles.yakindaText}>Yakında</Text>
                                    </View>
                                )}

                                {(isEditing && !isSoon) && (
                                    <TouchableOpacity
                                        style={styles.hideBtn}
                                        onPress={() => toggleVisibility(item.id)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons
                                            name={isHidden ? "eye-off" : "eye"}
                                            size={20}
                                            color={isHidden ? colors.muted : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                )}

                                {isSelected && (
                                    <View style={styles.swapOverlay}>
                                        <MaterialCommunityIcons name="swap-horizontal" size={24} color="#fff" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Fixed Footer Button */}
            <View style={styles.footerContainer}>
                <TouchableOpacity
                    style={styles.footerBtn}
                    onPress={() => navigation.navigate('About')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="information-outline" size={22} color={colors.accent} />
                    <Text style={styles.footerBtnText}>Hakkında</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </TouchableOpacity>
            </View>
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
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8
    },
    editHint: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border
    },
    editHintText: { color: colors.muted, fontSize: 13 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    menuCard: {
        width: '47%', backgroundColor: colors.card, borderRadius: 16,
        padding: 20, alignItems: 'center',
        borderWidth: 2, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
        position: 'relative', overflow: 'hidden'
    },
    menuCardSelected: {
        borderColor: colors.accent, backgroundColor: 'rgba(41, 121, 255, 0.1)'
    },
    iconWrap: {
        width: 56, height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', marginBottom: 12
    },
    menuTitle: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    hideBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 6,
        backgroundColor: colors.bg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border
    },
    swapOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(41, 121, 255, 0.4)', borderRadius: 14,
        alignItems: 'center', justifyContent: 'center'
    },
    footerContainer: {
        paddingHorizontal: 16, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg
    },
    footerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: colors.border
    },
    footerBtnText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
    yakindaBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: colors.accent,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        zIndex: 10
    },
    yakindaText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold'
    }
});
