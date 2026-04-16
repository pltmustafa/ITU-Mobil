import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import packageJson from '../../package.json';

export default function AboutScreen({ navigation }) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) {
            Alert.alert("Hata", "Lütfen bir mesaj yazın.");
            return;
        }

        setSending(true);
        try {
            // Gelişmiş Maskeleme: XOR ve CharCode Dizileri
            const _k = "itu-super-app";
            const _un = (d) => d.map((c, i) => String.fromCharCode(c ^ _k.charCodeAt(i % _k.length))).join('');
            
            const _u = _un([28, 14, 76, 74, 11, 66, 25, 28, 65, 67, 10, 24, 73, 12, 4, 13, 27, 30, 16, 22, 20, 17, 88, 83, 5, 67, 91, 26, 5, 28]);
            const _t = _un([8, 66, 18, 68, 20, 28, 4, 17, 28, 64, 2, 8, 17, 3, 65, 31, 72, 64, 13, 69, 11, 28, 92, 23, 67, 72, 3, 76, 6, 26]);
            const _api = _un([1, 0, 1, 93, 0, 79, 95, 74, 19, 93, 8, 94, 0, 28, 7, 29, 66, 5, 16, 2, 75, 28, 72, 21, 95, 65, 70, 25, 16, 94, 0, 20, 23, 0, 1, 3, 11, 3, 31, 7]);
            const _ttl = _un([345, 32, 169, 13, 62, 26, 18, 12, 30, 13, 38, 21, 2, 0, 84, 55, 68, 31, 17, 25, 23, 27, 64]);

            const response = await fetch(_api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: _t,
                    user: _u,
                    message: message,
                    title: _ttl
                }),
            });

            const data = await response.json();

            if (data.status === 1) {
                Alert.alert("Başarılı", "Mesajınız iletildi.");
                setMessage('');
            } else {
                Alert.alert("Hata", "Mesaj gönderilemedi, lütfen daha sonra tekrar deneyin.");
            }
        } catch (error) {
            Alert.alert("Hata", "Bağlantı hatası oluştu.");
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title}>Hakkında</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content}>
                    <MaterialCommunityIcons name="information-outline" size={64} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={styles.appName}>İTÜ Mobil</Text>
                    <Text style={styles.version}>Versiyon {packageJson.version}</Text>
                    <Text style={styles.description}>
                        Bu uygulama, ITÜ Mobil’in performans sorunları ve sınırlı özellikleri nedeniyle kişisel kullanım amacıyla geliştirilmiş, açık kaynaklı bir İTÜ Mobil projesidir.
                    </Text>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>Mustafa Polat</Text>
                    </View>

                    <View style={styles.feedbackContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialCommunityIcons name="bug-outline" size={22} color={colors.warning} />
                            <Text style={styles.feedbackTitle}>Hata Bildir / İletişim</Text>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Karşılaştığınız bir hatayı veya önerinizi yazın..."
                            placeholderTextColor={colors.muted}
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[styles.sendBtn, (!message.trim() || sending) && { opacity: 0.5 }]}
                            onPress={handleSend}
                            disabled={!message.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.sendBtnText}>Gönder</Text>
                                    <MaterialCommunityIcons name="send" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
    headerCenter: { flex: 1, marginHorizontal: 12, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    version: {
        fontSize: 16,
        color: colors.muted,
        marginBottom: 24,
    },
    description: {
        fontSize: 16,
        color: colors.muted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
    },
    badgeContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 32,
    },
    badgeText: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    feedbackContainer: {
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    feedbackTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginLeft: 8,
    },
    input: {
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        color: colors.text,
        fontSize: 15,
        minHeight: 120,
        marginBottom: 16,
    },
    sendBtn: {
        backgroundColor: colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 8,
    },
    sendBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
