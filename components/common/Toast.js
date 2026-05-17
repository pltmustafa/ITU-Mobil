/**
 * Toast — Animasyonlu hata/bilgi/başarı bildirimi
 * useToast() hook ile kullanılır.
 * 
 * Kullanım:
 *   const { showToast, ToastComponent } = useToast();
 *   showToast('Bağlantı hatası', 'error');
 *   // JSX'e ekle: {ToastComponent}
 */
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

const TOAST_DURATION = 3000;
const SLIDE_DURATION = 300;

const TOAST_CONFIG = {
    error: {
        icon: 'alert-circle-outline',
        bg: 'rgba(239, 68, 68, 0.95)',
        color: '#fff',
    },
    success: {
        icon: 'check-circle-outline',
        bg: 'rgba(34, 197, 94, 0.95)',
        color: '#fff',
    },
    info: {
        icon: 'information-outline',
        bg: 'rgba(41, 121, 255, 0.95)',
        color: '#fff',
    },
    warning: {
        icon: 'alert-outline',
        bg: 'rgba(250, 204, 21, 0.95)',
        color: '#000',
    },
};

function Toast({ message, type = 'error', translateY }) {
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.error;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.container,
                { backgroundColor: config.bg, transform: [{ translateY }] },
            ]}
        >
            <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
            <Text style={[styles.message, { color: config.color }]} numberOfLines={2}>
                {message}
            </Text>
        </Animated.View>
    );
}

export function useToast() {
    const [toast, setToast] = useState(null);
    const translateY = useRef(new Animated.Value(-100)).current;
    const hideTimer = useRef(null);

    const showToast = useCallback((message, type = 'error', duration = TOAST_DURATION) => {
        // Önceki toast'u temizle
        if (hideTimer.current) clearTimeout(hideTimer.current);

        setToast({ message, type });
        translateY.setValue(-100);

        // Slide in
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
        }).start();

        // Auto hide
        hideTimer.current = setTimeout(() => {
            Animated.timing(translateY, {
                toValue: -100,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }).start(() => setToast(null));
        }, duration);
    }, []);

    const ToastComponent = toast ? (
        <Toast message={toast.message} type={toast.type} translateY={translateY} />
    ) : null;

    return { showToast, ToastComponent };
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
});
