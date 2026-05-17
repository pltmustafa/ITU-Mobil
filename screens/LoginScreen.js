import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
    StatusBar,
    KeyboardAvoidingView,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import ituApi from '../services/ituApi';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Otomatik giriş — kayıtlı token varsa
    useEffect(() => {
        const tryAutoLogin = async () => {
            const stored = await ituApi.loadStoredToken();
            if (stored?.token) {
                // Arkaplanda senkronizasyonu başlat
                useAppStore.getState().refreshAll();
                
                navigation.replace('Dashboard', {
                    userInfo: stored.userInfo,
                });
            } else {
                setIsLoading(false);
            }
        };
        tryAutoLogin();
    }, []);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Kullanıcı adı ve şifre boş bırakılamaz.');
            return;
        }

        Keyboard.dismiss();
        setIsLoggingIn(true);
        setError('');

        const result = await ituApi.login(username.trim(), password);

        if (result.success) {
            // Arkaplanda senkronizasyonu başlat
            useAppStore.getState().refreshAll();

            navigation.replace('Dashboard', {
                userInfo: result.session,
            });
        } else {
            setError(result.error);
            setIsLoggingIn(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
                <View style={styles.loadingContainer}>
                    <View style={styles.logoCircle}>
                        <MaterialCommunityIcons name="school-outline" size={48} color={colors.accent} />
                    </View>
                    <Text style={styles.logoText}>İTÜ</Text>
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                    <Text style={styles.loadingText}>Oturum kontrol ediliyor...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <View style={styles.logoCircle}>
                                <MaterialCommunityIcons name="school-outline" size={48} color={colors.accent} />
                            </View>
                            <Text style={styles.logoText}>İTÜ</Text>
                        </View>

                        {/* Login Form */}
                        <View style={styles.formContainer}>
                            {/* Username */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
                                <View style={styles.inputRow}>
                                    <MaterialCommunityIcons name="account-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        value={username}
                                        onChangeText={(text) => {
                                            setUsername(text);
                                            if (error) setError('');
                                        }}
                                        placeholder="örn: polatmu23"
                                        placeholderTextColor={colors.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="next"
                                        editable={!isLoggingIn}
                                    />
                                </View>
                            </View>

                            {/* Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Şifre</Text>
                                <View style={styles.inputRow}>
                                    <MaterialCommunityIcons name="lock-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        value={password}
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            if (error) setError('');
                                        }}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.muted}
                                        secureTextEntry={!showPassword}
                                        returnKeyType="go"
                                        onSubmitEditing={handleLogin}
                                        editable={!isLoggingIn}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeBtn}
                                        onPress={() => setShowPassword(!showPassword)}
                                    >
                                        <MaterialCommunityIcons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color={colors.muted}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Error */}
                            {error ? (
                                <View style={styles.errorBox}>
                                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Login Button */}
                            <TouchableOpacity
                                style={[styles.loginBtn, isLoggingIn && styles.loginBtnDisabled]}
                                onPress={handleLogin}
                                disabled={isLoggingIn}
                                activeOpacity={0.8}
                            >
                                {isLoggingIn ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.loginBtnText}>Giriş Yap</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Footer */}
                        <Text style={styles.footer}>Mustafa Polat</Text>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'android' ? 30 : 0,
    },
    keyboardView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 16,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 40,
        paddingTop: 60,
    },
    logoContainer: {
        alignItems: 'center',
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 20,
    },
    logoText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.text,
        textShadowColor: colors.accentGlow,
        textShadowRadius: 15,
        letterSpacing: 4,
    },
    subtitle: {
        fontSize: 14,
        color: colors.muted,
        marginTop: 4,
        letterSpacing: 2,
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: colors.text,
    },
    eyeBtn: {
        padding: 8,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 23, 68, 0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 23, 68, 0.3)',
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        flex: 1,
    },
    loginBtn: {
        backgroundColor: colors.accent,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginBtnDisabled: {
        opacity: 0.7,
    },
    loginBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 1,
    },
    footer: {
        color: colors.muted,
        fontSize: 12,
        letterSpacing: 1,
    },
});
