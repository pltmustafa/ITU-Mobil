import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar } from 'react-native';
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

    useEffect(() => {
        // Ekran açıldı → 2 saniye moduna geç
        const fetchNextShuttles = async () => {
            try {
                const res = await fetch("https://mobil.itu.edu.tr/v2/service/service.aspx?method=GetShuttleInformation", {
                    headers: { 'User-Agent': 'okhttp/4.12.0', 'Accept': 'application/json, text/plain, */*', 'Accept-Encoding': 'gzip' }
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
                }
            } catch (e) {
                console.log("Shuttle info error", e);
            }
        };

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
                <View style={styles.topHudContainer}>
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
                </View>


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
    divider: { width: 1, backgroundColor: colors.border, marginVertical: 5 }
});