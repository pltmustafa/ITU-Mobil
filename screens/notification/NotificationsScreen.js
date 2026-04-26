import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl,
    Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import notificationApi from '../../services/notificationApi';
import { useObsStore } from '../../store/useObsStore';
import { useToast } from '../../components/common/Toast';

export default function NotificationsScreen({ navigation }) {
    const cachedNotifications = useObsStore((s) => s.notifications);
    const [notifications, setNotifications] = useState(cachedNotifications || []);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(cachedNotifications.length === 0);
    const { showToast, ToastComponent } = useToast();

    const fetchNotifications = async (isRefresh = false) => {
        if (!isRefresh && notifications.length === 0) setLoading(true);
        try {
            const list = await notificationApi.getNotifications(0);
            setNotifications(list);
            // Store'a da kaydet (cache) ve prefetch başlat
            const store = useObsStore.getState();
            store.notifications = list;
            store.prefetchNotificationDetails(list);
            
            // saveToCache(store); // useObsStore usually saves to cache itself on state changes if set via get().set()
        } catch (error) {
            if (notifications.length === 0) showToast(error.message, 'error');
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications(true);
    };

    useEffect(() => {
        // Arka planda güncelle (cache zaten gösterildi)
        fetchNotifications();
    }, []);

    const openNotification = (item) => {
        navigation.navigate('NotificationDetail', { notification: item });
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => openNotification(item)}
            activeOpacity={0.7}
        >
            <View style={styles.itemHeader}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.Title || 'Başlıksız'}</Text>
                <Text style={styles.itemDate}>{item.CreateDate || ''}</Text>
            </View>
            <Text style={styles.itemSummary} numberOfLines={2}>
                {item.SummaryText || ''}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bildirimler</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('NinovaAnnouncements')}
                    style={styles.announcementBtn}
                >
                    <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.accent} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={styles.emptyText}>Yükleniyor...</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.muted} />
                            <Text style={styles.emptyText}>Bildirim bulunamadı.</Text>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'android' ? 30 : 0
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        padding: 5,
    },
    announcementBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: `${colors.accent}18`,
        borderWidth: 1,
        borderColor: `${colors.accent}30`,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    // The FlatList usually takes full height (flex: 1 via container), 
    // so listContent needing to fill space for centering needs flexGrow.
    listContent: {
        padding: 20,
        flexGrow: 1, // Allows ListEmptyComponent to be centered
    },
    item: {
        backgroundColor: colors.card,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    itemTitle: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 15,
        flex: 1,
        marginRight: 10,
    },
    itemDate: {
        color: colors.muted,
        fontSize: 12,
    },
    itemSummary: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
    emptyContainer: {
        flex: 1, // Take up all available space in the grown container
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: colors.muted,
        marginTop: 10,
    }
});
