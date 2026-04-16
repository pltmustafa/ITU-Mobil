import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEAFLET_JS, LEAFLET_CSS } from './LeafletAssets';

const LeafletMap = ({ shuttles = [], routeCoordinates = [] }) => {
    const webViewRef = useRef(null);
    const isReady = useRef(false);

    // Platform'a göre başlangıç zoom seviyesi (Android'de kullanıcı memnun, iOS'ta daha zoomlu istendi)
    const initialZoom = Platform.OS === 'ios' ? 14.76 : 14.6;

    const sendData = () => {
        if (webViewRef.current && isReady.current) {
            const data = {
                type: 'UPDATE_DATA',
                shuttles,
                route: routeCoordinates
            };
            webViewRef.current.postMessage(JSON.stringify(data));
        }
    };

    // Veri her değiştiğinde WebView'a mesaj gönder
    useEffect(() => {
        sendData();
    }, [shuttles, routeCoordinates]);

    // İlk yükleme ve veri güncellemeleri için HTML şablonu
    const mapHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>[[LEAFLET_CSS]]</style>
        <script>[[LEAFLET_JS]]</script>
        <style>
            body { margin:0; padding:0; overflow: hidden; background: #1a1c23; }
            #map { width:100vw; height:100vh; background: #1a1c23; }
            .leaflet-container {
                background: #1a1c23 !important;
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            var map = L.map('map', {
                zoomControl: false,
                attributionControl: false,
                zoomSnap: 0,
                zoomDelta: 1,
                preferCanvas: true, // Marker ve Polylineları canvas üzerinde çizerek zoom sırasındaki kaymaları önler
                tap: false, 
                dragging: true,
                scrollWheelZoom: true,
                touchZoom: true,
                zoomAnimation: true
            }).setView([41.105, 29.026], ${initialZoom});

            // Harita stilini biraz açmak için CSS filter ekledik
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 20,
                className: 'lighter-map-tiles'
            }).addTo(map);

            // Mapper CSS Filter to lighten the dark map
            var style = document.createElement('style');
            style.innerHTML = '.lighter-map-tiles { filter: brightness(1.3) contrast(0.9); }';
            document.head.appendChild(style);

            var shuttleMarkers = {};
            var routePolyline = null;

            function updateMap(shuttles, route) {
                try {
                    if (route && route.length > 0) {
                        var latlngs = route.map(p => [p.latitude, p.longitude]);
                        if (routePolyline) {
                            routePolyline.setLatLngs(latlngs);
                        } else {
                            routePolyline = L.polyline(latlngs, {
                                color: '#2979FF', 
                                weight: 3,
                                opacity: 0.8,
                                lineJoin: 'round',
                                smoothFactor: 1.5 // Zoom sırasında daha yumuşak render için
                            }).addTo(map);
                        }
                    }

                    shuttles.forEach(s => {
                        var lat = parseFloat(String(s.Latitude).replace(',', '.'));
                        var lon = parseFloat(String(s.Longitude).replace(',', '.'));
                        
                        var iconUrl = s.IconPath ? 'https://harita.itu.edu.tr' + s.IconPath : 'https://harita.itu.edu.tr/Content/Images/ring_active_icon.png';
                        
                        var icon = L.divIcon({
                            html: '<div style="background-color: #2979FF; ' +
                                            'width: 24px; ' +
                                            'height: 24px; ' +
                                            'border-radius: 50%; ' +
                                            'border: 2px solid white; ' +
                                            'box-shadow: 0 0 12px rgba(41,121,255,1); ' +
                                            'display: flex; ' +
                                            'align-items: center; ' +
                                            'justify-content: center;">' +
                                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="white">' +
                                        '<path d="M18,11H15V13H18V11M6,11H3V13H6V11M10,11H8V21H10V11M14,11H12V21H14V11M20,21H4C2.9,21 2,20.1 2,19V10C2,8.9 2.9,8 4,8H20C21.1,8 22,8.9 22,10V19C22,20.1 21.1,21 20,21M18,6V4A2,2 0 0,0 16,2H8A2,2 0 0,0 6,4V6H18Z" />' +
                                        '<path d="M4,11V8C4,7.4 3.6,7 3,7S2,7.4 2,8V11C2,11.6 2.4,12 3,12S4,11.6 4,11Z" />' +
                                        '<path d="M22,11V8C22,7.4 21.6,7 21,7S20,7.4 20,8V11C20,11.6 20.4,12 21,12S22,11.6 22,11Z" />' +
                                    '</svg>' +
                                '</div>',
                            className: 'custom-shuttle-icon',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        });
                        
                        if (shuttleMarkers[s.DeviceNo]) {
                            shuttleMarkers[s.DeviceNo].setLatLng([lat, lon]);
                            shuttleMarkers[s.DeviceNo].setIcon(icon);
                            shuttleMarkers[s.DeviceNo].getPopup().setContent(
                                '<div style="text-align: center; color: #333; font-weight: 500;">' +
                                    '<b>Ring ' + s.DeviceNo + '</b><br/>' +
                                    '<span style="font-size: 11px; opacity: 0.8;">Hız: ' + s.Speed + ' km/s</span>' +
                                '</div>'
                            );
                        } else {
                            shuttleMarkers[s.DeviceNo] = L.marker([lat, lon], {icon: icon})
                                .addTo(map)
                                .bindPopup(
                                    '<div style="text-align: center; color: #333; font-weight: 500;">' +
                                        '<b>Ring ' + s.DeviceNo + '</b><br/>' +
                                        '<span style="font-size: 11px; opacity: 0.8;">Hız: ' + s.Speed + ' km/s</span>' +
                                    '</div>', 
                                    { closeButton: false }
                                );
                        }
                    });
                } catch(e) {}
            }

            function onMessage(event) {
                try {
                    var data = JSON.parse(event.data);
                    if (data.type === 'UPDATE_DATA') {
                        updateMap(data.shuttles, data.route);
                    }
                } catch(e) {}
            }

            document.addEventListener('message', onMessage);
            window.addEventListener('message', onMessage);

            // Sayfa yüklendiğinde mevcut verilerle başlat (Gecikmeyi önler)
            updateMap(${JSON.stringify(shuttles)}, ${JSON.stringify(routeCoordinates)});

            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'READY'}));
        </script>
    </body>
    </html>
    `
        .replace('[[LEAFLET_CSS]]', LEAFLET_CSS)
        .replace('[[LEAFLET_JS]]', LEAFLET_JS)
    , [initialZoom]); // Sadece zoom değişirse HTML yenilensin (genelde hiç yenilenmez)

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.map}
                scalesPageToFit={false}
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="always"
                allowsInlineMediaPlayback={true}
                textZoom={100} // Android font büyütme etkisini engeller
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'READY') {
                            isReady.current = true;
                            sendData();
                        }
                    } catch (e) { }
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1, backgroundColor: '#1a1c23' },
});

export default LeafletMap;
