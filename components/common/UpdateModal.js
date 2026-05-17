import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { colors } from '../../constants/colors';

const UpdateModal = ({ visible, latestVersion, changelog, onClose }) => {
    const changelogList = changelog
        ? changelog.replace(/\\n/g, '\n').split('\n').filter(line => line.trim() !== '')
        : [];

    const handleDownload = () => {
        Linking.openURL('https://github.com/pltmustafa/ITU-SuperApp/releases/tag/latest').catch(err =>
            console.error("Link açılırken hata oluştu:", err)
        );
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>Yeni Güncelleme Var</Text>
                        </View>
                        <View style={styles.versionBadge}>
                            <Text style={styles.versionText}>v{latestVersion}</Text>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {changelogList.length > 0 ? (
                            changelogList.map((item, index) => (
                                <View key={index} style={styles.changelogItem}>
                                    <View style={styles.bulletPoint} />
                                    <Text style={styles.changelogText}>{item.replace(/^[•*-]\s*/, '')}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyChangelog}>Bu sürümde performans iyileştirmeleri ve hata düzeltmeleri yapıldı.</Text>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.downloadButton}
                            onPress={handleDownload}
                        >
                            <Text style={styles.downloadButtonText}>Şimdi İndir</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.closeButton}
                            onPress={onClose}
                        >
                            <Text style={styles.closeButtonText}>Daha Sonra</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.card, // Deep Space Navy (#12151D)
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 24,
        maxHeight: '70%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    versionBadge: {
        backgroundColor: colors.accentGlow,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.accent + '40', // %25 Opacity accent
    },
    versionText: {
        color: colors.accent, // Electric Blue (#2979FF)
        fontSize: 12,
        fontWeight: 'bold',
    },
    content: {
        marginBottom: 24,
    },
    scrollContent: {
        paddingVertical: 4,
    },
    changelogItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    bulletPoint: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: colors.accent,
        marginTop: 9, // 17px metin için dikey orta nokta ayarı
        marginRight: 15,
    },
    changelogText: {
        fontSize: 17,
        lineHeight: 24,
        color: 'rgba(255,255,255,0.7)',
        flex: 1, // Kalan alanı kaplayarak metni sarmalar
    },
    emptyChangelog: {
        fontSize: 14,
        color: colors.muted,
        textAlign: 'center',
        marginVertical: 20,
    },
    footer: {
        width: '100%',
        gap: 12,
    },
    downloadButton: {
        backgroundColor: colors.accent, // Electric Blue (#2979FF)
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    closeButton: {
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    closeButtonText: {
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 16,
    },
});

export default UpdateModal;
