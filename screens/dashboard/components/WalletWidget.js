import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function WalletWidget({ balance, compact = false, onRefresh, refreshing }) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                    {refreshing ? (
                        <ActivityIndicator size={16} color={colors.accent} />
                    ) : (
                        <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.accent} />
                    )}
                </TouchableOpacity>
                <Text style={styles.title}>BAKİYE</Text>
            </View>

            <View style={styles.balanceContainer}>
                <Text style={[styles.currency, compact && { fontSize: 20 }]}>₺</Text>
                <Text style={[styles.amount, compact && { fontSize: 28 }]}>{balance || '0.00'}</Text>
            </View>

            {!compact && (
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.historyBtn}>
                        <Text style={styles.historyText}>Geçmiş</Text>
                    </TouchableOpacity>
                </View>
            )}
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
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 20,
    },
    currency: {
        color: colors.accent,
        fontSize: 24,
        fontWeight: 'bold',
        marginRight: 4,
    },
    amount: {
        color: colors.text,
        fontSize: 32,
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    historyBtn: {
        backgroundColor: colors.cardHover,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    historyText: {
        color: colors.textSecondary,
        fontSize: 13
    }
});
