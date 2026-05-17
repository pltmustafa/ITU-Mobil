import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AnnouncementsWidget({ announcements, onRefresh, refreshing }) {
    const data = announcements && announcements.length > 0 ? announcements : [];

    if (data.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                        {refreshing ? (
                            <ActivityIndicator size={16} color={colors.accent} />
                        ) : (
                            <MaterialCommunityIcons name="bullhorn-variant-outline" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.title}>DUYURULAR</Text>
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Henüz yeni duyuru yok.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                    {refreshing ? (
                        <ActivityIndicator size={16} color={colors.accent} />
                    ) : (
                        <MaterialCommunityIcons name="bullhorn-variant-outline" size={20} color={colors.accent} />
                    )}
                </TouchableOpacity>
                <Text style={styles.title}>DUYURULAR</Text>
            </View>

            <View style={styles.list}>
                {data.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.item, index === data.length - 1 && styles.lastItem]}
                        onPress={() => item.link && Linking.openURL(item.link).catch(() => { })}
                    >
                        <View style={styles.row}>
                            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                            <MaterialCommunityIcons name="open-in-new" size={14} color={colors.muted} />
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.source}>{item.sourceName}</Text>
                            <Text style={styles.date}>{item.timestamp ? new Date(item.timestamp).toLocaleDateString('tr-TR') : '-'}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
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
    list: {
        gap: 0,
    },
    item: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    lastItem: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    itemTitle: {
        color: colors.text,
        fontSize: 14,
        flex: 1,
        marginRight: 10,
        fontWeight: '500',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    source: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: 'bold',
    },
    date: {
        color: colors.muted,
        fontSize: 11,
    },
    emptyState: {
        padding: 10,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.muted,
        fontSize: 13,
    }
});
