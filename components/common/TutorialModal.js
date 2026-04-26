import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

const TUTORIAL_STEPS = [
    {
        title: 'Hoş Geldin!',
        description: 'Açık kaynaklı itü mobil istemcisine hoş geldin!',
        icon: 'human-greeting-variant',
        color: colors.accent,
    },
    {
        title: 'Düzenleme Modu',
        description: 'Ana ekrandaki hızlı erişim butonlarına veya menüdeki ikonlara basılı tutarak düzenleme moduna girebilirsiniz.',
        icon: 'gesture-tap-hold',
        color: colors.warning,
    },
    {
        title: 'Konum Değiştir',
        description: 'Düzenleme modundayken, iki widgeta sırayla tıklayarak yerlerini değiştirebilirsin.',
        icon: 'swap-vertical',
        color: colors.accent,
    },
    {
        title: 'Sağa/Sola Kaydır',
        description: 'Yemek Menüsü ve Ders Programı widgetlarını yatayda kaydırarak diğer günlere bakabilirsin.',
        icon: 'gesture-swipe-horizontal',
        color: colors.success,
    },
    {
        title: 'Veri Güncelleme',
        description: 'Widget ikonlarına tıklayarak verileri manuel güncelleyebilirsin. Ayrıca veriler arka planda otomatik olarak güncellenir.',
        icon: 'sync',
        color: colors.accent,
    },
    {
        title: 'Menü',
        description: 'Profil ikonuna basarak Menü\'ye gidebilirsin.',
        icon: 'menu',
        color: colors.info,
    },
    {
        title: 'Geri Bildirim',
        description: 'Menüdeki Hakkında kısmından hataları veya önerilerini direkt bana gönderebilirsin.\n\nMustafa Polat',
        icon: 'message-draw',
        color: colors.accent,
    },
];

export default function TutorialModal({ visible, onClose }) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const step = TUTORIAL_STEPS[currentStep];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: `${step.color}20` }]}>
                            <MaterialCommunityIcons name={step.icon} size={48} color={step.color} />
                        </View>

                        <Text style={styles.title}>{step.title}</Text>
                        <Text style={styles.description}>{step.description}</Text>

                        {/* Progress Dots */}
                        <View style={styles.dotContainer}>
                            {TUTORIAL_STEPS.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i === currentStep ? [styles.activeDot, { backgroundColor: step.color }] : styles.inactiveDot
                                    ]}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.footer}>
                        {currentStep > 0 ? (
                            <TouchableOpacity style={styles.skipBtn} onPress={handleBack}>
                                <Text style={styles.skipText}>Geri</Text>
                            </TouchableOpacity>
                        ) : <View style={styles.skipBtn} />}

                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: step.color }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>
                                {currentStep === TUTORIAL_STEPS.length - 1 ? 'Anladım' : 'Sıradaki'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: Math.min(width - 40, 400),
        backgroundColor: colors.card,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    content: {
        padding: 40,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        minHeight: 72,
    },
    dotContainer: {
        flexDirection: 'row',
        marginTop: 32,
        gap: 8,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    activeDot: {
        width: 24,
    },
    inactiveDot: {
        width: 6,
        backgroundColor: colors.muted,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    skipBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    skipText: {
        color: colors.muted,
        fontSize: 15,
        fontWeight: '600',
    },
    nextBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        minWidth: 100,
        alignItems: 'center',
    },
    nextText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
