import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RealTimeGPAWidget({ data, onPress }) {
    const hasData = data && data.gpa !== undefined;

    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.content}>
                <View>
                    <Text style={styles.label}>TAHMİNİ ORTALAMA</Text>
                    {hasData ? (
                        <View style={styles.valueRow}>
                            <Text style={styles.value}>{data.gpa}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{data.courses?.length || 0} Ders</Text>
                            </View>
                        </View>
                    ) : null}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.accent} />
            </View>
        </TouchableOpacity>
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
        // Glow
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 5,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    value: {
        color: colors.text,
        fontSize: 28,
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: 'rgba(41, 121, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(41, 121, 255, 0.2)',
    },
    badgeText: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: 'bold',
    },
    loading: {
        color: colors.muted,
        fontSize: 14,
        fontStyle: 'italic',
    }
});
