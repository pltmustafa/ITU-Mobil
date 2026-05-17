import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Modal, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import studentRoute from '../../assets/itu_ring_student_route.json';
import shuttleService from '../../services/shuttleService';
import LeafletMap from './components/LeafletMap';

export default function RingScreen({ navigation }) {
    const [shuttles, setShuttles] = useState(shuttleService.getShuttles());
    const [lastUpdated, setLastUpdated] = useState(shuttleService.getLastUpdated());
    const [nextVadi, setNextVadi] = useState('--:--');
    const [nextGolet, setNextGolet] = useState('--:--');
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [fullRota1, setFullRota1] = useState([]);
    const [fullRota2, setFullRota2] = useState([]);
    const scrollViewRef = useRef(null);

    useEffect(() => {
        if (scheduleModalVisible && scrollViewRef.current) {
            const index1 = fullRota1.findIndex(t => t === nextVadi);
            const index2 = fullRota2.findIndex(t => t === nextGolet);
            const targetIndex = Math.max(index1, index2);
            
            if (targetIndex > 0) {
                // Estimate row height as ~40px. Scroll to index - 2 so the active item is near the top but gives context.
                const yOffset = Math.max(0, (targetIndex - 2) * 40);
                setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: yOffset, animated: false });
                }, 50);
            }
        }
    }, [scheduleModalVisible]);

    // Rota Verisi Hazırlama
    const routeCoordinates = React.useMemo(() => {
        const coords = [];
        studentRoute.forEach(segment => {
            const stopLat = parseFloat(segment.stop.lat.replace(',', '.'));
            const stopLon = parseFloat(segment.stop.lon.replace(',', '.'));
            if (!isNaN(stopLat) && !isNaN(stopLon) && (stopLat !== 0 || stopLon !== 0)) {
                coords.push({ latitude: stopLat, longitude: stopLon });
            }
            if (segment.path_to_next) {
                segment.path_to_next.forEach(point => {
                    const pLat = parseFloat(point.Latitude);
                    const pLon = parseFloat(point.Longitude);
                    if (!isNaN(pLat) && !isNaN(pLon) && (pLat !== 0 || pLon !== 0)) {
                        coords.push({ latitude: pLat, longitude: pLon });
                    }
                });
            }
        });
        return coords;
    }, []);

    const fetchNextShuttles = async () => {
        try {
            const res = await fetch("https://mobil.itu.edu.tr/v2/service/service.aspx?method=GetShuttleInformation", {
                headers: { 'User-Agent': 'okhttp/4.12.0', 'Accept': 'application/json, text/plain, */*', 'Accept-Encoding': 'gzip' },
                cache: 'no-store'
            });
            const data = await res.json();
            
            if (data.ResultCode === "SUCC" && data.StudentShuttleInformation) {
                const parseNext = (rotaArr) => {
                    if (!rotaArr) return '--:--';
                    const timeRegex = /^(\d{2}):(\d{2})$/;
                    const today = new Date();
                    let currentMinutes = today.getHours() * 60 + today.getMinutes();
                    if (today.getHours() < 4) currentMinutes += 24 * 60; // Support night shuttles
                    
                    let nextTime = null;
                    let nextMinutes = Infinity;
                    
                    rotaArr.forEach(t => {
                        const match = t.match(timeRegex);
                        if (match) {
                            let h = parseInt(match[1], 10);
                            let m = parseInt(match[2], 10);
                            if (h < 4) h += 24;
                            const tMins = h * 60 + m;
                            if (tMins > currentMinutes && tMins < nextMinutes) {
                                nextMinutes = tMins;
                                nextTime = t;
                            }
                        }
                    });
                    
                    if (!nextTime) { // If no shuttles left today, fetch tomorrow's earliest
                         let minMins = Infinity;
                         rotaArr.forEach(t => {
                            const match = t.match(timeRegex);
                            if (match) {
                                let h = parseInt(match[1], 10);
                                let m = parseInt(match[2], 10);
                                if (h < 4) h += 24; 
                                const tMins = h * 60 + m;
                                if (tMins < minMins) {
                                    minMins = tMins;
                                    nextTime = t;
                                }
                            }
                        });
                    }
                    return nextTime || '--:--';
                };
                
                setNextVadi(parseNext(data.StudentShuttleInformation.Rota1));
                setNextGolet(parseNext(data.StudentShuttleInformation.Rota2));
                setFullRota1(data.StudentShuttleInformation.Rota1 || []);
                setFullRota2(data.StudentShuttleInformation.Rota2 || []);
            }
        } catch (e) {
            console.log("Shuttle info error", e);
        }
    };

    useEffect(() => {
        fetchNextShuttles();

        // Listener ile state güncelle
        const unsubscribe = shuttleService.subscribe((newShuttles, updated) => {
            setShuttles(newShuttles);
            setLastUpdated(updated);
            // Refresh schedule every minute roughly based on push updates
            if (new Date().getSeconds() < 2) fetchNextShuttles();
        });

        return () => {
            unsubscribe();
            shuttleService.setBackgroundMode();
        };
    }, []);

    return (
        <View style={styles.container}>
            {console.log("RENDER -> fullRota1 length:", fullRota1.length, "nextVadi:", nextVadi)}
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrapper}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.accent} />
                </TouchableOpacity>
                <Text style={styles.title}>CANLI RİNG TAKİP</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.mapContainer}>
                <LeafletMap 
                    shuttles={shuttles}
                    routeCoordinates={routeCoordinates}
                />

                {/* Top Schedule HUD Overlay */}
                <TouchableOpacity 
                    style={styles.topHudContainer} 
                    onPress={() => {
                        fetchNextShuttles(); // Refresh data on open
                        setScheduleModalVisible(true);
                    }} 
                    activeOpacity={0.8}
                >
                    {nextVadi === nextGolet ? (
                        <View style={styles.hudItem}>
                            <Text style={[styles.hudLabel, { color: colors.accent, fontSize: 11 }]}>SONRAKİ RİNG</Text>
                            <Text style={styles.hudValue}>{nextVadi}</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.hudItem}>
                                <Text style={[styles.hudLabel, { color: colors.accent }]}>VADİ'DEN</Text>
                                <Text style={styles.hudValue}>{nextVadi}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.hudItem}>
                                <Text style={[styles.hudLabel, { color: colors.accent }]}>GÖLET'TEN</Text>
                                <Text style={styles.hudValue}>{nextGolet}</Text>
                            </View>
                        </>
                    )}
                </TouchableOpacity>

                <Modal
                    visible={scheduleModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setScheduleModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setScheduleModalVisible(false)} />
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Tüm Ring Saatleri</Text>
                            </View>
                            
                            <View style={styles.scheduleTitlesRow}>
                                <Text style={[styles.columnTitle, { flex: 1, textAlign: 'center' }]}>Vadi'den</Text>
                                <View style={[styles.dividerVertical, { backgroundColor: 'transparent' }]} />
                                <Text style={[styles.columnTitle, { flex: 1, textAlign: 'center' }]}>Gölet'ten</Text>
                            </View>
                            
                            <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scheduleColumns}>
                                <View style={styles.scheduleColumn}>
                                    {fullRota1.length > 0 ? fullRota1.map((time, idx) => (
                                        <Text key={`vadi-${idx}`} style={[styles.timeText, time === nextVadi && styles.nextTimeText]}>{time}</Text>
                                    )) : <Text style={styles.timeText}>-</Text>}
                                </View>
                                <View style={styles.dividerVertical} />
                                <View style={styles.scheduleColumn}>
                                    {fullRota2.length > 0 ? fullRota2.map((time, idx) => (
                                        <Text key={`golet-${idx}`} style={[styles.timeText, time === nextGolet && styles.nextTimeText]}>{time}</Text>
                                    )) : <Text style={styles.timeText}>-</Text>}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15,
        backgroundColor: colors.bg,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        zIndex: 10
    },
    backBtnWrapper: { padding: 5 },
    title: { fontSize: 14, fontWeight: 'bold', color: colors.text, letterSpacing: 1 },
    mapContainer: { flex: 1, overflow: 'hidden' },
    topHudContainer: {
        position: 'absolute',
        top: 20, alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 15, 15, 0.95)',
        borderRadius: 20,
        padding: 12,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10
    },
    hudItem: { alignItems: 'center', paddingHorizontal: 15 },
    hudLabel: { color: colors.muted, fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
    hudValue: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
    divider: { width: 1, backgroundColor: colors.border, marginVertical: 5 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: colors.bg,
        borderRadius: 15,
        width: '100%',
        height: '80%',
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card
    },
    modalTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    scheduleTitlesRow: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingTop: 10
    },
    scheduleColumns: {
        flexDirection: 'row',
        padding: 10
    },
    scheduleColumn: {
        flex: 1,
        alignItems: 'center',
    },
    columnTitle: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 5
    },
    dividerVertical: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: 10,
        marginVertical: 10
    },
    scrollView: {
        width: '100%',
        flex: 1
    },
    timeText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        paddingVertical: 8,
        width: '100%'
    },
    nextTimeText: {
        color: colors.accent,
        fontWeight: 'bold',
        fontSize: 18,
        backgroundColor: colors.accentGlow,
        borderRadius: 8,
        overflow: 'hidden',
        width: '80%',
        alignSelf: 'center',
        marginVertical: 4
    }
});