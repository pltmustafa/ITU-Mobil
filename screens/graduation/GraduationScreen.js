import { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ActivityIndicator, Platform, StatusBar, ScrollView,
    LayoutAnimation, UIManager, Modal, TextInput, KeyboardAvoidingView,
    TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useObsStore } from '../../store/useObsStore';
import { useToast } from '../../components/common/Toast';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const decodeHTMLEntities = (text) => {
    return text
        .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/gi, (match, dec) => String.fromCharCode(dec))
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
};

export default function GraduationScreen({ navigation }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedTerms, setExpandedTerms] = useState({});

    // Modal states for URL input
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [planUrl, setPlanUrl] = useState('');
    const [scraping, setScraping] = useState(false);

    const { showToast, ToastComponent } = useToast();

    useEffect(() => { loadData(); }, []);

    // Auto-expand first incomplete term
    useEffect(() => {
        if (data?.courses) {
            const grouped = {};
            data.courses.forEach(c => {
                const term = c.donemNo || 99;
                if (!grouped[term]) grouped[term] = [];
                grouped[term].push(c);
            });
            const sortedTerms = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));

            for (const term of sortedTerms) {
                const isComplete = grouped[term].every(c => c.isMet);
                if (!isComplete) {
                    setExpandedTerms({ [term]: true });
                    break;
                }
            }
        }
    }, [data]);

    const loadData = async () => {
        setLoading(true);
        try {
            const cachedPlan = await AsyncStorage.getItem('obs_course_plan_v3');
            if (!cachedPlan) {
                setShowUrlModal(true);
                return;
            }
            const planCoursesDb = JSON.parse(cachedPlan);
            await mergeGradesAndPlan(planCoursesDb);
        } catch (err) {
            showToast('Veriler yüklenemedi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchAndParsePlan = async (url) => {
        if (!url || !url.includes('DersPlanDetay')) {
            showToast('Lütfen geçerli bir İTÜ Ders Planı linki girin', 'error');
            return;
        }

        setScraping(true);
        try {
            const response = await fetch(url);
            const html = await response.text();

            // Match all tables with class 'datalist'
            const tablesRegex = /<table[^>]*class="[^"]*datalist[^"]*"[^>]*>([\s\S]*?)<\/table>/ig;
            let tables = [];
            let match;
            while ((match = tablesRegex.exec(html)) !== null) {
                tables.push(match[1]);
            }

            let coursesDb = {};
            let termIndex = 1;
            let electiveCounter = 1;

            for (const tableHtml of tables) {
                const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/ig;
                let trMatch;
                while ((trMatch = trRegex.exec(tableHtml)) !== null) {
                    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/ig;
                    let tds = [];
                    let tdMatch;
                    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
                        let firstPart = tdMatch[1].split(/<br\s*\/?>/i)[0];
                        let text = decodeHTMLEntities(firstPart.replace(/<[^>]+>/g, '').trim());
                        tds.push(text);
                    }

                    if (tds.length >= 6) {
                        const rawCode = tds[0].replace(/\s+/g, ''); // "INS111" or "Dersler"
                        const name = tds[1];
                        const creditStr = tds[4];
                        const credit = parseFloat(creditStr.replace(',', '.'));

                        const isElective = rawCode === 'Dersler' || (name && (name.toLowerCase().includes('seçmeli') || name.toLowerCase().includes('seçim')));

                        if ((rawCode || isElective) && !isNaN(credit) && credit >= 0) {
                            if (isElective) {
                                // Elective course
                                const uniqueCode = `ELECTIVE_${termIndex}_${electiveCounter}`;
                                electiveCounter++;
                                coursesDb[uniqueCode] = {
                                    donemNo: termIndex,
                                    bransKodu: '',
                                    dersKodu: '',
                                    dersAdi: name,
                                    kredisi: credit,
                                };
                            } else {
                                // Match letters for brans, and the rest for num
                                const matchBrans = rawCode.match(/^[A-Za-z]+/) || rawCode.match(/^[A-Za-zÇĞİÖŞÜçğıöşü]+/);
                                const brans = matchBrans ? matchBrans[0] : '';
                                const num = rawCode.substring(brans.length);
                                const code = `${brans} ${num}`;

                                coursesDb[code] = {
                                    donemNo: termIndex,
                                    bransKodu: brans,
                                    dersKodu: num,
                                    dersAdi: name,
                                    kredisi: credit,
                                };
                            }
                        }
                    }
                }
                termIndex++;
            }

            if (Object.keys(coursesDb).length === 0) {
                showToast('Ders planından hiç ders bulunamadı.', 'error');
                return;
            }

            await AsyncStorage.setItem('obs_course_plan_v3', JSON.stringify(coursesDb));
            setShowUrlModal(false);
            showToast('Ders planı başarıyla kaydedildi!', 'success');
            await mergeGradesAndPlan(coursesDb);
        } catch (err) {
            console.error(err);
            showToast('Ders planı indirilirken bir hata oluştu.', 'error');
        } finally {
            setScraping(false);
        }
    };

    const mergeGradesAndPlan = async (planCoursesDb) => {
        try {
            const cachedTermsStr = await AsyncStorage.getItem('obs_terms_cache_v3');
            const terms = cachedTermsStr ? JSON.parse(cachedTermsStr) : [];

            const userGrades = {};
            let totalEarned = 0;
            let requiredTotal = 0;

            let isCurrentTerm = true;
            for (const term of terms) {
                if (!term.courses) {
                    isCurrentTerm = false;
                    continue;
                }
                for (const c of term.courses) {
                    const nameParts = c.name ? c.name.split(' - ') : [];
                    let code = nameParts[0] ? nameParts[0].trim() : c.code;
                    if (!code) continue;

                    let letter = c.harfNotu || c.basariNotu || null;

                    if (c.sinifId) {
                        try {
                            const gStr = await AsyncStorage.getItem(`obs_grades_${c.sinifId}`);
                            if (gStr) {
                                const gradeObj = JSON.parse(gStr);
                                if (gradeObj.harfNotu && gradeObj.harfNotu !== '-') {
                                    letter = gradeObj.harfNotu;
                                }
                            }
                        } catch (err) { }
                    }

                    if (letter && letter !== '-') {
                        userGrades[code] = letter;
                    } else if (!isCurrentTerm) {
                        // Geçmiş dönem ama notu henüz çekilmemişse (İleride API eklenecek)
                        if (!userGrades[code]) {
                            userGrades[code] = 'Geçti'; // Geçici olarak geçti sayıyoruz
                        }
                    } else if (isCurrentTerm) {
                        if (!userGrades[code]) {
                            userGrades[code] = 'Devam'; // Güncel dönem devam ediyor
                        }
                    }
                }
                isCurrentTerm = false;
            }

            const coursesArr = [];
            const processedElectives = new Set();

            Object.keys(planCoursesDb).forEach(code => {
                const pc = planCoursesDb[code];

                // If it's an elective (no bransKodu), check if any user grade matches that isn't mapped
                let grade = null;
                let isMet = false;

                if (code.startsWith('ELECTIVE_')) {
                    // Check if there is an unmapped completed course in userGrades
                    // For simplicity, ANY completed course not explicitly in the plan could satisfy an elective
                    // Note: A smarter way is required for real ITU rules (SNT vs ITB vs MT vs TM) 
                    // but for a generic tracker, we just don't map it here directly unless we do exact matching.
                    // Instead, we will add unmapped userGrades at the end as "extra/elective satisfied".
                    isMet = false;
                    grade = null;
                } else {
                    grade = userGrades[code];
                    isMet = grade && !['FF', 'VF', 'BZ', 'Devam'].includes(grade);
                }

                coursesArr.push({
                    donemNo: pc.donemNo,
                    bransKodu: pc.bransKodu,
                    dersKodu: pc.dersKodu,
                    dersAdi: pc.dersAdi,
                    kredisi: pc.kredisi,
                    isMet: !!isMet,
                    harfNotu: grade || null
                });

                requiredTotal += pc.kredisi;
                if (isMet) {
                    totalEarned += pc.kredisi;
                }
            });

            // Add excess/elective courses taken by user that are NOT in the exact plan matches
            Object.keys(userGrades).forEach(code => {
                if (!planCoursesDb[code]) {
                    const grade = userGrades[code];
                    const isMet = grade && !['FF', 'VF', 'BZ', 'Devam'].includes(grade);

                    const parts = code.split(' ');
                    const brans = parts[0] || '';
                    const num = parts.slice(1).join(' ') || '';

                    coursesArr.push({
                        donemNo: 99,
                        bransKodu: brans,
                        dersKodu: num,
                        dersAdi: code,
                        kredisi: 3, // assume 3 credits for unmapped electives 
                        isMet: !!isMet,
                        harfNotu: grade || null
                    });

                    // We don't add to requiredTotal here, because the required total already includes the Elective slots!
                    if (isMet) {
                        totalEarned += 3;
                    }
                }
            });

            const finalData = {
                metKrediTotal: totalEarned,
                gerekliMezuniyetKredisi: requiredTotal,
                courses: coursesArr
            };

            setData(finalData);

            try {
                useObsStore.getState().setGraduationData(finalData);
            } catch (e) { }

        } catch (err) {
            console.error(err);
            showToast('Notlar birleştirilirken hata oluştu.', 'error');
        }
    };

    const toggleTerm = (term) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedTerms(prev => ({ ...prev, [term]: !prev[term] }));
    };

    const handleClearPlan = async () => {
        await AsyncStorage.removeItem('obs_course_plan_v3');
        setData(null);
        setShowUrlModal(true);
    };

    const earned = data?.metKrediTotal || 0;
    const required = data?.gerekliMezuniyetKredisi || 132;
    const remaining = Math.max(0, required - earned);
    const percentage = Math.min(100, required > 0 ? (earned / required) * 100 : 0);

    const groupedCourses = {};
    if (data?.courses) {
        data.courses.forEach(c => {
            const term = c.donemNo || 99;
            if (!groupedCourses[term]) groupedCourses[term] = [];
            groupedCourses[term].push(c);
        });
    }
    const terms = Object.keys(groupedCourses).sort((a, b) => parseInt(a) - parseInt(b));

    const getGradeColor = (grade) => {
        if (!grade) return colors.muted;
        if (['AA', 'BA', 'BB'].includes(grade)) return colors.success;
        if (['CB', 'CC'].includes(grade)) return colors.warning;
        if (['DD', 'DC'].includes(grade)) return '#FF9800';
        if (['FF', 'VF'].includes(grade)) return colors.danger;
        return colors.text;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="school-outline" size={24} color={colors.accent} />
                    <Text style={styles.title}>Mezuniyet</Text>
                </View>
                <TouchableOpacity onPress={handleClearPlan} style={styles.headerBtn} disabled={loading}>
                    <MaterialCommunityIcons name="refresh" size={24} color={loading ? colors.muted : colors.text} />
                </TouchableOpacity>
            </View>

            {loading && !showUrlModal ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Mezuniyet verileriniz hesaplanıyor...</Text>
                </View>
            ) : data ? (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressRing}>
                            <View style={styles.progressInner}>
                                <Text style={styles.progressPercent}>{Math.round(percentage)}%</Text>
                                <Text style={styles.progressLabel}>Tamamlandı</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.success}20` }]}>
                                <MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.success }]}>{earned}</Text>
                            <Text style={styles.statLabel}>Tamamlanan</Text>
                        </View>

                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent}20` }]}>
                                <MaterialCommunityIcons name="target" size={24} color={colors.accent} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.accent }]}>{required}</Text>
                            <Text style={styles.statLabel}>Toplam</Text>
                        </View>

                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.warning}20` }]}>
                                <MaterialCommunityIcons name="clock-outline" size={24} color={colors.warning} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.warning }]}>{remaining}</Text>
                            <Text style={styles.statLabel}>Kalan</Text>
                        </View>
                    </View>

                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarHeader}>
                            <Text style={styles.progressBarLabel}>İlerleme</Text>
                            <Text style={styles.progressBarValue}>{earned} / {required} kredi</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                        </View>
                    </View>

                    <View style={styles.roadmapContainer}>
                        {terms.map(term => {
                            const termCourses = groupedCourses[term];
                            const completedCount = termCourses.filter(c => c.isMet).length;
                            const isComplete = completedCount === termCourses.length;
                            const isExpanded = expandedTerms[term];
                            const termLabel = term == 99 ? "Seçmeli / Diğer" : `${term}. Yarıyıl`;

                            return (
                                <View key={term} style={styles.termContainer}>
                                    <TouchableOpacity
                                        style={styles.termHeader}
                                        onPress={() => toggleTerm(term)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.termHeaderLeft}>
                                            <View>
                                                <Text style={styles.termTitle}>{termLabel}</Text>
                                                <Text style={styles.termSubtitle}>
                                                    {completedCount}/{termCourses.length} Ders Tamamlandı
                                                </Text>
                                            </View>
                                        </View>
                                        <MaterialCommunityIcons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={24}
                                            color={colors.muted}
                                        />
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.termBody}>
                                            {termCourses.map((course, idx) => (
                                                <View key={idx} style={styles.courseRow}>
                                                    <View style={[styles.statusIndicator, { backgroundColor: course.isMet ? colors.success : colors.danger }]} />
                                                    <View style={styles.courseMain}>
                                                        {course.bransKodu ? (
                                                            <>
                                                                <Text style={styles.courseCode}>{course.bransKodu} {course.dersKodu}</Text>
                                                                <Text style={styles.courseName}>{course.dersAdi}</Text>
                                                            </>
                                                        ) : (
                                                            <Text style={styles.courseCode}>{course.dersAdi}</Text>
                                                        )}
                                                    </View>
                                                    <View style={styles.courseRight}>
                                                        <Text style={styles.creditBadge}>{course.kredisi} Kr</Text>
                                                        {course.harfNotu ? (
                                                            <View style={[styles.gradeBadge, { borderColor: getGradeColor(course.harfNotu) }]}>
                                                                <Text style={[styles.gradeText, { color: getGradeColor(course.harfNotu) }]}>
                                                                    {course.harfNotu}
                                                                </Text>
                                                            </View>
                                                        ) : (
                                                            !course.isMet && (
                                                                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
                                                            )
                                                        )}
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            ) : null}

            <Modal visible={showUrlModal} animationType="slide" transparent statusBarTranslucent={true}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <MaterialCommunityIcons name="link-variant" size={28} color={colors.accent} />
                                <Text style={styles.modalTitle}>Ders Planı Gerekli</Text>
                            </View>
                            <Text style={styles.modalSub}>Lütfen obs.itu.edu.tr üzerinden kendi bölümünüzün Ders Planı Detay linkini yapıştırın.</Text>

                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="web" size={20} color={colors.muted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="https://obs.itu.edu.tr/public/DersPlan/..."
                                    placeholderTextColor={colors.muted}
                                    value={planUrl}
                                    onChangeText={setPlanUrl}
                                    autoCapitalize="none"
                                    editable={!scraping}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.confirmBtn, scraping && { opacity: 0.7 }]}
                                onPress={() => fetchAndParsePlan(planUrl)}
                                disabled={scraping}
                            >
                                {scraping ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="cloud-download" size={20} color="#fff" />}
                                <Text style={styles.confirmBtnText}>{scraping ? 'İndiriliyor...' : 'Planı Kaydet'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ alignItems: 'center', marginTop: 16, padding: 10 }}
                                onPress={() => { setShowUrlModal(false); navigation.goBack(); }}
                                disabled={scraping}
                            >
                                <Text style={{ color: colors.muted, fontSize: 14 }}>Geri Dön</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </Modal>
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
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text, textShadowColor: colors.accentGlow, textShadowRadius: 8 },

    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },

    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    progressContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    progressRing: {
        width: 180, height: 180, borderRadius: 90,
        borderWidth: 12, borderColor: `${colors.accent}30`,
        alignItems: 'center', justifyContent: 'center'
    },
    progressInner: {
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: colors.card, borderWidth: 6, borderColor: colors.accent,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 12, elevation: 4
    },
    progressPercent: { fontSize: 40, fontWeight: 'bold', color: colors.accent },
    progressLabel: { color: colors.muted, fontSize: 14, marginTop: 4 },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
        flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border
    },
    statIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },

    progressBarContainer: {
        backgroundColor: colors.card, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 30
    },
    progressBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    progressBarLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
    progressBarValue: { color: colors.muted, fontSize: 14 },
    progressBar: { height: 14, backgroundColor: colors.bg, borderRadius: 7, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 7, backgroundColor: colors.accent },

    roadmapContainer: { marginTop: 10 },

    termContainer: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border
    },
    termHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, backgroundColor: colors.cardHover,
    },
    termHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    termTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    termSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    termBody: { padding: 16, paddingTop: 8 },
    courseRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    statusIndicator: { width: 3, height: 32, borderRadius: 2, marginRight: 12 },
    courseMain: { flex: 1 },
    courseCode: { color: colors.text, fontWeight: '600', fontSize: 14 },
    courseName: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    courseRight: { alignItems: 'flex-end' },
    creditBadge: { color: colors.muted, fontSize: 11, marginBottom: 4 },
    gradeBadge: {
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
        borderWidth: 1, minWidth: 28, alignItems: 'center'
    },
    gradeText: { fontSize: 12, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.bg, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    modalSub: { fontSize: 14, color: colors.muted, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 14
    },
    input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 14 },
    confirmBtn: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 12, marginTop: 10 },
    confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
