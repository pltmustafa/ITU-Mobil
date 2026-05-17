import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity,
    TextInput, Modal, Alert, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '../../components/common/Toast';


const GRADE_POINTS = {
    "-": null, // Seçilmemiş
    "AA": 4.0, "BA+": 3.75, "BA": 3.5, "BB+": 3.25, "BB": 3.0,
    "CB+": 2.75, "CB": 2.5, "CC+": 2.25, "CC": 2.0,
    "DC+": 1.75, "DC": 1.5, "DD+": 1.25, "DD": 1.0,
    "FD+": 0.5, "FD": 0.5, // FD ve FD+ genelde 0.5 veya 0.0 alınır, yönetmelik değişebilir
    "FF": 0.0, "VF": 0.0
};
const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

export default function GPASimulatorScreen({ navigation, route }) {
    const { initialData } = route.params || {};

    const [courses, setCourses] = useState([]);
    const [simulatedGPA, setSimulatedGPA] = useState({ gpa: 0, total_credits: 0, total_points: 0 });
    const [originalGPA, setOriginalGPA] = useState({ gpa: 0, total_credits: 0 });

    const [addModalVisible, setAddModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedCourseIndex, setSelectedCourseIndex] = useState(null);

    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseCredit, setNewCourseCredit] = useState('');
    const [newCourseGrade, setNewCourseGrade] = useState('AA');

    const [isLoading, setIsLoading] = useState(false);
    const { showToast, ToastComponent } = useToast();

    useEffect(() => {
        if (initialData?.courses) {
            // Rota üzerinden veri geldiyse onu kullan (Manuel geçiş)
            loadInitialData(initialData);
        } else {
            // Yoksa sunucudan çek
            loadServerData();
        }
    }, [initialData]);

    const loadInitialData = (data) => {
        const loadedCourses = data.courses.map(c => ({
            ...c, isOriginal: true, id: Math.random().toString(36).substr(2, 9)
        }));
        setCourses(loadedCourses);
        setOriginalGPA({ gpa: data.gpa, total_credits: data.total_credits });
        calculateGPA(loadedCourses);
    };

    const loadServerData = async () => {
        setIsLoading(true);
        try {
            const { useObsStore } = require('../../store/useObsStore');
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const storeState = useObsStore.getState();

            // 1. Mevcut GPA ve Kredi Bilgisi
            const gpaVal = parseFloat(storeState.userData?.gpa) || 0;
            const creditVal = parseFloat(storeState.userData?.credits) || 0;
            setOriginalGPA({ gpa: gpaVal, total_credits: creditVal });

            // 2. Güncel Dersler
            let currentCourses = [];

            // Önce obs_terms_cache_v3'ten (CoursesScreen'in kaydettiği cache) güncel dönemi almayı deneyelim
            try {
                const termCache = await AsyncStorage.getItem('obs_terms_cache_v3');
                if (termCache) {
                    const terms = JSON.parse(termCache);
                    if (terms && terms.length > 0 && terms[0].courses) {
                        currentCourses = terms[0].courses;
                    }
                }
            } catch (e) {
                console.warn('Terms cache read error', e);
            }

            // Eğer terms cache boşsa, dashboard'dan gelen classes'ı kullanalım (tekilleştirerek)
            if (currentCourses.length === 0 && storeState.classes) {
                const uniqueMap = {};
                storeState.classes.forEach(c => {
                    if (c.sinifId && !uniqueMap[c.sinifId]) {
                        uniqueMap[c.sinifId] = {
                            sinifId: c.sinifId,
                            name: c.code + ' - ' + c.name,
                            code: c.code
                        };
                    }
                });
                currentCourses = Object.values(uniqueMap);
            }

            // Mezuniyet datasından kredi bilgisini eşleştirmek için hazırlık
            // Önce AsyncStorage'daki obs_course_plan_v3 cache'ini oku (GraduationScreen kaydeder)
            let planCoursesDb = {};
            let hasPlanCache = false;
            try {
                const planStr = await AsyncStorage.getItem('obs_course_plan_v3');
                if (planStr) {
                    planCoursesDb = JSON.parse(planStr);
                    hasPlanCache = Object.keys(planCoursesDb).length > 0;
                }
            } catch (e) { }

            // Ayrıca Zustand'daki graduationData'yı da fallback olarak kullan
            const gradCourses = storeState.graduationData?.courses || [];

            const mappedCourses = [];
            for (const c of currentCourses) {
                // CourseName format: "BLG 101E - Bilgisayara Giriş"
                const codeMatch = c.name ? c.name.split(' - ')[0] : c.code;
                const brans = codeMatch ? codeMatch.split(' ')[0] : '';
                const ders = codeMatch ? codeMatch.split(' ')[1] : '';

                let credit = 3; // Default

                // 1) obs_course_plan_v3 cache'inden kredi ara
                const planKey = `${brans} ${ders}`;
                if (planCoursesDb[planKey] && planCoursesDb[planKey].kredisi != null) {
                    credit = parseFloat(planCoursesDb[planKey].kredisi);
                } else if (planCoursesDb[codeMatch] && planCoursesDb[codeMatch].kredisi != null) {
                    credit = parseFloat(planCoursesDb[codeMatch].kredisi);
                } else {
                    // 2) Fallback: Zustand graduationData courses
                    const gradMatch = gradCourses.find(gc =>
                        (gc.bransKodu === brans && gc.dersKodu === ders) ||
                        (gc.bransKodu + ' ' + gc.dersKodu === codeMatch)
                    );
                    if (gradMatch && gradMatch.kredisi != null) {
                        credit = parseFloat(gradMatch.kredisi);
                    }
                }

                // Harf notunu obs_grades_ cache'inden al
                let grade = '-';
                let isOriginal = false;
                if (c.sinifId) {
                    try {
                        const gradeStr = await AsyncStorage.getItem('obs_grades_' + c.sinifId);
                        if (gradeStr) {
                            const gradeData = JSON.parse(gradeStr);
                            if (gradeData?.harfNotu) {
                                grade = gradeData.harfNotu;
                                // Eğer VF veya - değilse, isOriginal'i true yapalım
                                if (grade !== '-' && grade !== '') {
                                    isOriginal = true;
                                }
                            }
                        }
                    } catch (e) { }
                }

                mappedCourses.push({
                    id: c.sinifId || Math.random().toString(36).substr(2, 9),
                    code: codeMatch || 'CRS',
                    name: c.name || 'Ders',
                    credit: credit,
                    grade: grade,
                    isOriginal: isOriginal,
                    is_graded: isOriginal
                });
            }

            setCourses(mappedCourses);
            calculateGPA(mappedCourses);

            // Ders planı cache'i yoksa uyar
            if (!hasPlanCache) {
                showToast(`Kredi bilgileri bulunamadı. Mezuniyet ekranına ders planı linkini girmeniz gerekiyor.`, 'info', 5000);
            }

        } catch (error) {
            console.error('GPA Data Load Error:', error);
            if (courses.length === 0) {
                Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const calculateGPA = (courseList) => {
        let totalPoints = 0, totalCredits = 0;
        courseList.forEach(course => {
            const credit = parseFloat(course.credit);
            if (!isNaN(credit) && credit > 0) {
                const points = GRADE_POINTS[course.grade];
                // Points null değilse (yani '-' değilse) hesaba kat
                if (points !== undefined && points !== null) {
                    totalPoints += points * credit;
                    totalCredits += credit;
                }
            }
        });
        setSimulatedGPA({
            gpa: totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00',
            total_credits: totalCredits,
            total_points: totalPoints.toFixed(2)
        });
    };

    const handleAddCourse = () => {
        if (!newCourseName || !newCourseCredit) {
            Alert.alert('Eksik Bilgi', 'Lütfen ders adı ve kredisini giriniz.');
            return;
        }
        const credit = parseFloat(newCourseCredit);
        if (isNaN(credit)) {
            Alert.alert('Hata', 'Kredi sayısal bir değer olmalıdır.');
            return;
        }
        const newCourse = {
            id: Math.random().toString(36).substr(2, 9),
            code: 'YENİ', name: newCourseName, credit,
            grade: newCourseGrade, isOriginal: false
        };
        const updatedCourses = [...courses, newCourse];
        setCourses(updatedCourses);
        calculateGPA(updatedCourses);
        setNewCourseName(''); setNewCourseCredit(''); setNewCourseGrade('AA');
        setAddModalVisible(false);
    };

    const handleDeleteCourse = (index) => {
        const updatedCourses = [...courses];
        updatedCourses.splice(index, 1);
        setCourses(updatedCourses);
        calculateGPA(updatedCourses);
    };

    const openEditModal = (index) => {
        setSelectedCourseIndex(index);
        setNewCourseGrade(courses[index].grade);
        setEditModalVisible(true);
    };

    const handleUpdateGrade = () => {
        if (selectedCourseIndex !== null) {
            const updatedCourses = [...courses];
            updatedCourses[selectedCourseIndex].grade = newCourseGrade;
            setCourses(updatedCourses);
            calculateGPA(updatedCourses);
            setEditModalVisible(false);
        }
    };

    const getDiffInfo = () => {
        const original = parseFloat(originalGPA.gpa);
        const simulated = parseFloat(simulatedGPA.gpa);
        const diff = (simulated - original).toFixed(2);
        if (simulated > original) return { color: colors.success, icon: 'trending-up', diff: `+ ${diff} ` };
        if (simulated < original) return { color: colors.danger, icon: 'trending-down', diff };
        return { color: colors.muted, icon: 'minus', diff: '0.00' };
    };

    const getGradeColor = (grade) => {
        if (grade === '-') return colors.muted;
        const point = GRADE_POINTS[grade];
        if (point >= 3.0) return colors.success;
        if (point >= 2.0) return colors.warning;
        return colors.danger;
    };

    const diffInfo = getDiffInfo();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="calculator-variant" size={24} color={colors.accent} />
                    <Text style={styles.title}>GPA Simülatörü</Text>
                </View>
                <TouchableOpacity onPress={loadServerData} style={styles.headerBtn} disabled={isLoading}>
                    <MaterialCommunityIcons name="refresh" size={24} color={isLoading ? colors.muted : colors.text} />
                </TouchableOpacity>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Mevcut</Text>
                        <Text style={styles.summaryValue}>{originalGPA.gpa}</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                        <MaterialCommunityIcons name="arrow-right" size={28} color={colors.muted} />
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Simüle</Text>
                        <Text style={[styles.summaryValue, { color: diffInfo.color }]}>{simulatedGPA.gpa}</Text>
                    </View>
                </View>
                <View style={styles.diffRow}>
                    <View style={[styles.diffBadge, { backgroundColor: `${diffInfo.color} 20` }]}>
                        <MaterialCommunityIcons name={diffInfo.icon} size={16} color={diffInfo.color} />
                        <Text style={[styles.diffText, { color: diffInfo.color }]}>{diffInfo.diff}</Text>
                    </View>
                    <Text style={styles.summarySub}>{simulatedGPA.total_credits} Kredi · {simulatedGPA.total_points} Puan</Text>
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Ders Listesi ({courses.length})</Text>

                {courses.map((course, index) => (
                    <TouchableOpacity
                        key={course.id}
                        style={[styles.courseCard, !course.isOriginal && styles.addedCourse]}
                        onPress={() => openEditModal(index)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.gradeCircle, { backgroundColor: `${getGradeColor(course.grade)} 20` }]}>
                            <Text style={[styles.gradeText, { color: getGradeColor(course.grade) }]}>{course.grade}</Text>
                        </View>
                        <View style={styles.courseInfo}>
                            <Text style={styles.courseCode}>{course.code}</Text>
                            <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                        </View>
                        <View style={styles.courseRight}>
                            <Text style={styles.creditText}>{course.credit} Kr</Text>
                            {!course.isOriginal && (
                                <TouchableOpacity onPress={() => handleDeleteCourse(index)} style={styles.deleteBtn}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                                </TouchableOpacity>
                            )}
                            {/* Notu açıklanmamış ama listeden gelen dersler için silme butonu yerine işaret koyabiliriz veya silmeye izin verebiliriz */}
                            {/* Şimdilik: isOriginal=false olanlar (bizim eklediklerimiz veya notu olmayanlar) silinebilir. 
                                Backend'den is_graded=false gelenleri isOriginal=false yaptık, yani silinebilirler. 
                                Bu mantıklı, kullanıcı dersi simülasyondan çıkarmak isteyebilir. */}
                        </View>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
                    <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.accent} />
                    <Text style={styles.addBtnText}>Yeni Ders Ekle</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* ADD COURSE MODAL */}
            <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <MaterialCommunityIcons name="book-plus-outline" size={28} color={colors.accent} />
                            <Text style={styles.modalTitle}>Ders Ekle</Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Ders Adı"
                                placeholderTextColor={colors.muted}
                                value={newCourseName}
                                onChangeText={setNewCourseName}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="counter" size={20} color={colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Kredi"
                                placeholderTextColor={colors.muted}
                                keyboardType="numeric"
                                value={newCourseCredit}
                                onChangeText={setNewCourseCredit}
                            />
                        </View>

                        <Text style={styles.gradeLabel}>Not Seçin</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
                            {GRADE_OPTIONS.map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.gradeOption, newCourseGrade === g && styles.gradeOptionSelected]}
                                    onPress={() => setNewCourseGrade(g)}
                                >
                                    <Text style={[styles.gradeOptionText, newCourseGrade === g && { color: '#fff' }]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleAddCourse}>
                                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                                <Text style={styles.confirmBtnText}>Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* EDIT GRADE MODAL */}
            <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <MaterialCommunityIcons name="pencil" size={28} color={colors.accent} />
                            <Text style={styles.modalTitle}>Notu Değiştir</Text>
                        </View>
                        <Text style={styles.modalSub}>
                            {selectedCourseIndex !== null && courses[selectedCourseIndex]?.name}
                        </Text>

                        <View style={styles.gradeGrid}>
                            {GRADE_OPTIONS.map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.gradeGridItem, newCourseGrade === g && { backgroundColor: getGradeColor(g), borderColor: getGradeColor(g) }]}
                                    onPress={() => setNewCourseGrade(g)}
                                >
                                    <Text style={[styles.gradeGridText, newCourseGrade === g && { color: '#fff' }]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateGrade}>
                                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                                <Text style={styles.confirmBtnText}>Güncelle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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

    summaryCard: {
        margin: 16, padding: 20, backgroundColor: colors.card, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 4
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { color: colors.muted, fontSize: 13, marginBottom: 6 },
    summaryValue: { fontSize: 36, fontWeight: 'bold', color: colors.text },
    arrowContainer: { padding: 10 },
    diffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    diffBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    diffText: { fontWeight: 'bold', fontSize: 14 },
    summarySub: { color: colors.muted, fontSize: 13 },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

    courseCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: colors.border
    },
    addedCourse: {
        // borderColor: colors.accent, borderStyle: 'dashed' // Mavi çizgi kaldırıldı
    },
    gradeCircle: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    gradeText: { fontSize: 16, fontWeight: 'bold' },
    courseInfo: { flex: 1, marginLeft: 14 },
    courseCode: { color: colors.accent, fontWeight: 'bold', fontSize: 13 },
    courseName: { color: colors.text, fontSize: 14, marginTop: 2 },
    courseRight: { alignItems: 'flex-end', gap: 6 },
    creditText: { color: colors.muted, fontSize: 12, backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    deleteBtn: { padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 8 },

    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: colors.card, padding: 16, borderRadius: 14,
        borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 6
    },
    addBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.bg, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    modalSub: { fontSize: 14, color: colors.muted, marginBottom: 16, textAlign: 'center' },

    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 14
    },
    input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 16 },

    gradeLabel: { color: colors.muted, fontSize: 13, marginBottom: 10, textTransform: 'uppercase' },
    gradeScroll: { maxHeight: 50, marginBottom: 20 },
    gradeOption: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.card, marginRight: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    gradeOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    gradeOptionText: { color: colors.text, fontWeight: 'bold', fontSize: 15 },

    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
    gradeGridItem: { width: 52, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    gradeGridText: { color: colors.text, fontWeight: 'bold', fontSize: 15 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    cancelBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12 },
    cancelBtnText: { color: colors.text, fontWeight: '600' },
    confirmBtn: { flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, borderRadius: 12 },
    confirmBtnText: { color: '#fff', fontWeight: 'bold' }
});
