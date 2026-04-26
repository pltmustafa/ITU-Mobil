import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import FileViewer from 'react-native-file-viewer';
import { colors } from '../../constants/colors';
import ninovaApi from '../../services/ninovaApi';

const CACHE_KEY_FILES_PREFIX = 'ninova_files_';

const parseDate = (d) => {
    if (!d) return '';
    try {
        let date;
        if (typeof d === 'string' && d.includes('/Date(')) {
            const num = parseInt(d.replace(/[^0-9]/g, ''), 10);
            date = new Date(num);
        } else {
            date = new Date(d);
        }

        if (isNaN(date.getTime())) return d;

        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return d;
    }
};

const getRemainingTimeStyle = (d) => {
    if (!d) return null;
    try {
        let end;
        if (typeof d === 'string' && d.includes('/Date(')) {
            const num = parseInt(d.replace(/[^0-9]/g, ''), 10);
            end = new Date(num);
        } else {
            end = new Date(d);
        }

        if (isNaN(end.getTime())) return null;

        const now = new Date();
        const diffMs = end - now;

        if (diffMs < 0) return { text: 'Süresi Doldu', color: '#ef4444' };

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (diffDays > 7) return { text: `${diffDays} gün kaldı`, color: colors.muted };
        if (diffDays > 0) return { text: `${diffDays} gün kaldı`, color: '#f59e0b' };
        if (diffHours > 0) return { text: `${diffHours} saat kaldı`, color: '#f59e0b' };
        return { text: 'Son dakikalar!', color: '#ef4444' };
    } catch (e) {
        return null;
    }
};

const FolderCard = ({ node, pathStr, category, dersId, sinifId, allPrefetchedFiles, navigateToFolder }) => {
    const [subItemsCount, setSubItemsCount] = useState(null);

    useEffect(() => {
        const folderPath = (pathStr || '') + node.DosyaAdi + '/';
        const folderSuffix = `_${folderPath.replace(/\//g, '_')}`;
        const folderCacheKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_${category}${folderSuffix}`;

        if (allPrefetchedFiles?.[folderCacheKey]) {
            setSubItemsCount(allPrefetchedFiles[folderCacheKey].length);
        } else {
            AsyncStorage.getItem(folderCacheKey).then(val => {
                if (val) setSubItemsCount(JSON.parse(val).length);
            });
        }
    }, [node, pathStr, category, dersId, sinifId, allPrefetchedFiles]);

    const cleanName = (str) => str?.replace(/([\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '').trim() || '';

    return (
        <TouchableOpacity style={styles.itemCard} onPress={() => navigateToFolder(node)}>
            <View style={[styles.itemIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <MaterialCommunityIcons name="folder" size={24} color="#fbbf24" />
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{cleanName(node.DosyaAdi)}</Text>
                {subItemsCount !== null && (
                    <Text style={styles.itemSubtext}>{subItemsCount} Dosya</Text>
                )}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>
    );
};

export default function NinovaDetailScreen({ navigation, route }) {
    const { title, dersId, sinifId, pathStr, category, preloadedFiles, allPrefetchedFiles } = route.params;

    // category can be 'ders', 'sinif', or null (root)
    const isRoot = !category;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(!isRoot);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [homeworkCount, setHomeworkCount] = useState(null);
    const [dersFileCount, setDersFileCount] = useState(null);
    const [sinifFileCount, setSinifFileCount] = useState(null);

    useEffect(() => {
        const homeworkCacheKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_homeworks`;

        if (isRoot) {
            const dersKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_ders`;
            const sinifKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_sinif`;
            const homeworkKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_homeworks`;

            // Homework Count
            if (preloadedFiles?.homeworks) setHomeworkCount(preloadedFiles.homeworks.length);
            else if (allPrefetchedFiles?.[homeworkKey]) setHomeworkCount(allPrefetchedFiles[homeworkKey].length);
            else {
                AsyncStorage.getItem(homeworkKey).then(val => {
                    if (val) setHomeworkCount(JSON.parse(val).length);
                    else ninovaApi.getNinovaHomeworks(dersId, sinifId).then(res => setHomeworkCount(res.length)).catch(() => setHomeworkCount(0));
                });
            }

            // Ders Dosyaları Count
            if (preloadedFiles?.ders) setDersFileCount(preloadedFiles.ders.length);
            else if (allPrefetchedFiles?.[dersKey]) setDersFileCount(allPrefetchedFiles[dersKey].length);
            else {
                AsyncStorage.getItem(dersKey).then(val => {
                    if (val) setDersFileCount(JSON.parse(val).length);
                    else ninovaApi.getNinovaFiles(dersId, sinifId, 1, '').then(res => setDersFileCount(res.length)).catch(() => setDersFileCount(0));
                });
            }

            // Sınıf Dosyaları Count
            if (preloadedFiles?.sinif) setSinifFileCount(preloadedFiles.sinif.length);
            else if (allPrefetchedFiles?.[sinifKey]) setSinifFileCount(allPrefetchedFiles[sinifKey].length);
            else {
                AsyncStorage.getItem(sinifKey).then(val => {
                    if (val) setSinifFileCount(JSON.parse(val).length);
                    else ninovaApi.getNinovaFiles(dersId, sinifId, 0, '').then(res => setSinifFileCount(res.length)).catch(() => setSinifFileCount(0));
                });
            }

            return;
        }

        const loadFiles = async () => {
            const catKey = category;
            const pathSuffix = pathStr ? `_${pathStr.replace(/\//g, '_')}` : '';
            const cacheKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_${catKey}${pathSuffix}`;

            // 1. Preloaded varsa direkt kullan (root seviye prefetch ile geldi)
            if (!pathStr && preloadedFiles?.[catKey]) {
                setItems(preloadedFiles[catKey]);
                setLoading(false);
                console.log('[NinovaDetail] Preloaded\'dan yüklendi:', catKey);
                return;
            }

            // 2. allPrefetchedFiles'dan cache key ile kontrol (alt klasörler dahil)
            if (allPrefetchedFiles?.[cacheKey] && allPrefetchedFiles[cacheKey].length > 0) {
                const data = allPrefetchedFiles[cacheKey];
                console.log('[NinovaDetail] Prefetch verilerinden yüklendi:', cacheKey, 'items:', data.length);
                setItems(data);
                setLoading(false);
                return;
            }

            // Homeworks özel durum
            if (category === 'homeworks') {
                const homeworkCacheKey = `${CACHE_KEY_FILES_PREFIX}${dersId}_${sinifId}_homeworks`;
                try {
                    const cached = await AsyncStorage.getItem(homeworkCacheKey);
                    if (cached) {
                        setItems(JSON.parse(cached));
                        setLoading(false);
                        return;
                    }
                } catch (e) { }

                try {
                    const result = await ninovaApi.getNinovaHomeworks(dersId, sinifId);
                    setItems(result || []);
                    await AsyncStorage.setItem(homeworkCacheKey, JSON.stringify(result));
                } catch (e) {
                    Alert.alert('Hata', 'Ödevler yüklenemedi.');
                } finally {
                    setLoading(false);
                }
                return;
            }

            // 3. AsyncStorage cache kontrol (hem root hem alt klasörler için)
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.length > 0) {
                        setItems(parsed);
                        setLoading(false);
                        console.log('[NinovaDetail] Cache\'den yüklendi:', cacheKey);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[NinovaDetail] Cache okuma hatası:', e);
            }

            // 3. Cache yoksa API'den çek
            setLoading(true);
            try {
                const caseType = category === 'ders' ? 1 : 0;
                const result = await ninovaApi.getNinovaFiles(dersId, sinifId, caseType, pathStr || '');
                setItems(result || []);

                // Cache'e kaydet
                if (result) {
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
                }
            } catch (e) {
                console.error(e);
                Alert.alert('Hata', 'Dosyalar yüklenirken bir sorun oluştu.');
            } finally {
                setLoading(false);
            }
        };
        loadFiles();
    }, [dersId, sinifId, pathStr, category, isRoot]);

    const openFile = async (node) => {
        if (!node.Path) return;

        // TypeId 3 (Link) özel durumu - Tüm linkler için token ve suffix gerekli
        if (node.TypeId == 3) {
            setDownloadingId(node.DosyaAdi);
            try {
                const token = await ninovaApi.getNinovaFileSystemToken();
                if (!token) throw new Error("Token alınamadı.");
                const urlSuffix = category === 'sinif' ? 'ders' : 'sinif';
                let targetUrl = `${node.Path}${token}/${urlSuffix}`;
                targetUrl = targetUrl.replace(/^http:\/\//i, 'https://');
                await Linking.openURL(targetUrl);
            } catch (e) {
                Alert.alert('Hata', 'Bağlantı açılamadı.');
            } finally {
                setDownloadingId(null);
            }
            return;
        }

        setDownloadingId(node.DosyaAdi);
        setDownloadProgress(0);
        try {
            const token = await ninovaApi.getNinovaFileSystemToken();
            if (!token) throw new Error("Dosya token'ı alınamadı.");

            let downloadUrl = "";

            if (node.isHomeworkFile) {
                // Homework URL pattern: {Path}/{Token}/odev/{OdevId}
                downloadUrl = `${node.Path}${token}/odev/${node.OdevId}`;
            } else {
                // Normal file URL pattern — suffix must match the category
                const urlSuffix = category === 'sinif' ? 'ders' : 'sinif';
                downloadUrl = `${node.Path}${token}/${urlSuffix}`;
            }

            downloadUrl = downloadUrl.replace(/^http:\/\//i, 'https://');

            // Dosya uzantısını garanti altına al — QuickLook uzantısız dosyaları açamaz
            const ext = (node.Extension || node.DosyaAdi?.split('.').pop() || 'bin').toLowerCase();
            const baseName = node.DosyaAdi
                .replace(/\.[^.]+$/, '')           // mevcut uzantıyı sil
                .replace(/[^a-zA-Z0-9\-_]/g, '_') // Türkçe & özel karakterleri temizle
                .substring(0, 60);                  // çok uzun isim olmasın
            const fileName = `${baseName}_${Date.now()}.${ext}`;
            const localUri = `${FileSystem.cacheDirectory}${fileName}`;

            console.log("Download URL:", downloadUrl, "-> saving as:", fileName);

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                localUri,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 16; 22101320C Build/BP4A.251205.006) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.109 Mobile Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'upgrade-insecure-requests': '1',
                        'x-requested-with': 'mark.via.gp',
                        'sec-fetch-site': 'none',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-user': '?1',
                        'sec-fetch-dest': 'document',
                        'sec-ch-ua': '"Not:A-Brand";v="99", "Android WebView";v="145", "Chromium";v="145"',
                        'sec-ch-ua-mobile': '?1',
                        'sec-ch-ua-platform': '"Android"',
                        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
                    }
                },
                (progressInfo) => {
                    if (progressInfo.totalBytesExpectedToWrite > 0) {
                        const progress = progressInfo.totalBytesWritten / progressInfo.totalBytesExpectedToWrite;
                        setDownloadProgress(progress);
                    }
                }
            );

            const { uri, status } = await downloadResumable.downloadAsync();

            const fileInfoInitial = await FileSystem.getInfoAsync(uri);
            console.log("File size:", fileInfoInitial.size, "Status:", status);

            if (fileInfoInitial.size === 0) {
                throw new Error("Dosya indirildi ancak boyutu 0 byte.");
            }

            // — Dosya imza kontrolü: yanlış uzantı tespiti ve HTML hata sayfası koruması —
            let finalUri = uri;
            const cleanExt = ext.replace('.', '').trim();
            try {
                const b64 = await FileSystem.readAsStringAsync(finalUri, {
                    encoding: FileSystem.EncodingType.Base64,
                    length: 30,
                });
                console.log(`[SignatureCheck] cleanExt='${cleanExt}' b64prefix='${b64.substring(0, 10)}'`);

                // 'UEsDB' = Base64 of ZIP local-file header PK\x03\x04 (5 chars covers ALL ZIP versions)
                if (b64.startsWith('UEsDB')) {
                    if (['ppt', 'doc', 'xls'].includes(cleanExt)) {
                        // Dosya aslında modern Office (OOXML/ZIP) formatında ama uzantısı eski
                        const correctedExt = cleanExt + 'x';
                        const fixedUri = finalUri.replace(/\.[^.]+$/, '.' + correctedExt);
                        await FileSystem.moveAsync({ from: finalUri, to: fixedUri });
                        finalUri = fixedUri;
                        console.log(`[SignatureCheck] Uzantı düzeltildi: .${cleanExt} -> .${correctedExt}`);
                    }
                }
                // HTML hata sayfası kontrolü
                // PCFET0NU = <!DOCT, PGh0bWw = <html, DQo8IURPQ = \r\n<!DOC
                else if (b64.startsWith('PCFET0NU') || b64.startsWith('PGh0bWw') || b64.startsWith('DQo8')) {
                    throw new Error("Ninova dosya yerine HTML hata sayfası döndürdü (yetki/oturum sorunu).");
                }
            } catch (sigErr) {
                if (sigErr.message.includes('Ninova')) throw sigErr;
                console.log('[SignatureCheck] imza kontrolü atlandı:', sigErr.message);
            }

            console.log(`[FileOpen] Açılacak URI: ${finalUri}`);

            try {
                await FileViewer.open(finalUri, { showOpenWithDialog: false });
            } catch (err) {
                console.log("[FileViewer] Açılamadı, paylaşım menüsüne düşülüyor…", err);
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(finalUri, {
                        dialogTitle: 'Dosyayı Aç veya Kaydet'
                    });
                } else {
                    Alert.alert('Hata', 'Paylaşım/Görüntüleme bu cihazda desteklenmiyor.');
                }
            }
        } catch (e) {
            console.error('File download/view error:', e);
            Alert.alert('Hata', 'Dosya indirilemedi veya açılamadı. ' + e.message);
        } finally {
            setDownloadingId(null);
        }
    };

    const navigateToFolder = (node) => {
        const currentPrefix = pathStr ? pathStr : '';
        const newPath = currentPrefix + node.DosyaAdi + '/';

        navigation.push('NinovaDetail', {
            title: node.DosyaAdi,
            dersId,
            sinifId,
            pathStr: newPath,
            category,
            allPrefetchedFiles
        });
    };

    const navigateToCategory = (catName, catKey) => {
        navigation.push('NinovaDetail', {
            title: catName,
            dersId,
            sinifId,
            pathStr: '',
            category: catKey,
            preloadedFiles,
            allPrefetchedFiles
        });
    }

    const getFileIcon = (ext) => {
        const icons = {
            'pdf': 'file-pdf-box', 'doc': 'file-word', 'docx': 'file-word',
            'xls': 'file-excel', 'xlsx': 'file-excel', 'ppt': 'file-powerpoint', 'pptx': 'file-powerpoint',
            'zip': 'folder-zip', 'rar': 'folder-zip', '7z': 'folder-zip',
            'mp4': 'file-video', 'avi': 'file-video', 'mkv': 'file-video', 'mov': 'file-video',
            'mp3': 'file-music', 'wav': 'file-music',
            'jpg': 'file-image', 'jpeg': 'file-image', 'png': 'file-image', 'gif': 'file-image',
            'txt': 'file-document', 'py': 'language-python', 'js': 'language-javascript',
            'html': 'language-html5', 'css': 'language-css3'
        };
        return icons[ext] || 'file-outline';
    };

    const getFileColor = (ext) => {
        const colorMap = {
            'pdf': '#dc2626', 'doc': '#2563eb', 'docx': '#2563eb', 'xls': '#16a34a',
            'xlsx': '#16a34a', 'ppt': '#ea580c', 'pptx': '#ea580c', 'zip': '#eab308',
            'mp4': '#7c3aed', 'mp3': '#ec4899', 'jpg': '#06b6d4', 'png': '#06b6d4'
        };
        return colorMap[ext] || colors.accent;
    };

    const cleanName = (str) => str?.replace(/([\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '').trim() || '';

    const renderRootCategories = () => (
        <View>
            <TouchableOpacity style={styles.itemCard} onPress={() => navigateToCategory('Ders Dosyaları', 'ders')}>
                <View style={[styles.itemIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                    <MaterialCommunityIcons name="folder" size={24} color="#fbbf24" />
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>Ders Dosyaları</Text>
                    {dersFileCount !== null && <Text style={styles.itemSubtext}>{dersFileCount} Dosya</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.itemCard} onPress={() => navigateToCategory('Sınıf Dosyaları', 'sinif')}>
                <View style={[styles.itemIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                    <MaterialCommunityIcons name="folder" size={24} color="#fbbf24" />
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>Sınıf Dosyaları</Text>
                    {sinifFileCount !== null && <Text style={styles.itemSubtext}>{sinifFileCount} Dosya</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>
            {homeworkCount > 0 && (
                <TouchableOpacity style={styles.itemCard} onPress={() => navigateToCategory('Ödevler', 'homeworks')}>
                    <View style={[styles.itemIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                        <MaterialCommunityIcons name="file-edit-outline" size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>Ödevler</Text>
                        {homeworkCount > 0 && <Text style={[styles.itemSubtext, { color: '#3b82f6', fontSize: 10 }]}>{homeworkCount} Ödev</Text>}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title} numberOfLines={1}>{cleanName(title)}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {isRoot ? (
                        renderRootCategories()
                    ) : (
                        items.length > 0 ? (
                            items.map((node, idx) => {


                                // Homework handling
                                if (category === 'homeworks') {
                                    const homework = node;
                                    const hasFile = homework.DosyaList && homework.DosyaList.length > 0;
                                    const firstFile = hasFile ? homework.DosyaList[0] : null;

                                    const isDownloading = firstFile && downloadingId === firstFile.DosyaAdi;

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.itemCard, isDownloading && { opacity: 0.6 }]}
                                            onPress={() => {
                                                if (hasFile) {
                                                    openFile({
                                                        ...firstFile,
                                                        OdevId: homework.OdevId,
                                                        isHomeworkFile: true
                                                    });
                                                }
                                            }}
                                            disabled={isDownloading}
                                        >
                                            <View style={[styles.itemIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                                <MaterialCommunityIcons name="file-edit-outline" size={24} color="#3b82f6" />
                                            </View>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName} numberOfLines={2}>{cleanName(homework.OdevBaslik)}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                    <Text style={styles.itemSubtext}>Bitiş: {parseDate(homework.OdevTeslimBitis)}</Text>
                                                    {(() => {
                                                        const remaining = getRemainingTimeStyle(homework.OdevTeslimBitis);
                                                        if (!remaining) return null;
                                                        return (
                                                            <Text style={[styles.itemSubtext, { color: remaining.color, fontWeight: '700' }]}>
                                                                • {remaining.text}
                                                            </Text>
                                                        );
                                                    })()}
                                                </View>
                                                {homework.OdevAciklama ? (
                                                    <Text style={[styles.itemSubtext, { fontSize: 11 }]} numberOfLines={1}>{homework.OdevAciklama}</Text>
                                                ) : null}
                                            </View>
                                            {hasFile && (
                                                isDownloading ? (
                                                    <View style={{ alignItems: 'center' }}>
                                                        <ActivityIndicator size="small" color={colors.accent} />
                                                        {downloadProgress > 0 && downloadProgress < 1 && (
                                                            <Text style={{ fontSize: 10, color: colors.accent, marginTop: 4, fontWeight: 'bold' }}>
                                                                {Math.round(downloadProgress * 100)}%
                                                            </Text>
                                                        )}
                                                    </View>
                                                ) : (
                                                    <MaterialCommunityIcons name="download" size={20} color={colors.accent} />
                                                )
                                            )}
                                        </TouchableOpacity>
                                    );
                                }

                                if (node.TypeId == 1) { // 1: Folder
                                    return (
                                        <FolderCard
                                            key={idx}
                                            node={node}
                                            pathStr={pathStr}
                                            category={category}
                                            dersId={dersId}
                                            sinifId={sinifId}
                                            allPrefetchedFiles={allPrefetchedFiles}
                                            navigateToFolder={navigateToFolder}
                                        />
                                    );
                                }

                                if (node.TypeId == 2 || node.TypeId == 3) { // 2: File, 3: Link/Video
                                    const ext = node.Extension || node.DosyaAdi?.split('.').pop()?.toLowerCase() || '';
                                    const isLink = node.TypeId == 3;
                                    const iconName = isLink ? 'link-variant' : getFileIcon(ext);
                                    const iconColor = isLink ? '#8b5cf6' : getFileColor(ext);

                                    const isDownloading = downloadingId === node.DosyaAdi;

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.itemCard, isDownloading && { opacity: 0.6 }]}
                                            onPress={() => openFile(node)}
                                            disabled={isDownloading}
                                        >
                                            <View style={[styles.itemIcon, { backgroundColor: `${iconColor}20` }]}>
                                                <MaterialCommunityIcons name={iconName} size={24} color={iconColor} />
                                            </View>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName} numberOfLines={2}>{cleanName(node.DosyaAdi)}</Text>
                                                {!isLink && (
                                                    <Text style={styles.itemSubtext}>
                                                        {node.Boyut || `${ext.toUpperCase()} Dosyası`}
                                                    </Text>
                                                )}
                                                {node.Tarih && (
                                                    <Text style={[styles.itemSubtext, { marginTop: 2, fontSize: 10, opacity: 0.6 }]}>
                                                        {node.Tarih}
                                                    </Text>
                                                )}
                                            </View>
                                            {isDownloading ? (
                                                <View style={{ alignItems: 'center' }}>
                                                    <ActivityIndicator size="small" color={colors.accent} />
                                                    {downloadProgress > 0 && downloadProgress < 1 && (
                                                        <Text style={{ fontSize: 10, color: colors.accent, marginTop: 4, fontWeight: 'bold' }}>
                                                            {Math.round(downloadProgress * 100)}%
                                                        </Text>
                                                    )}
                                                </View>
                                            ) : (
                                                <MaterialCommunityIcons name={isLink ? 'open-in-new' : 'download'} size={20} color={colors.accent} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }
                                return null;
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="folder-open-outline" size={64} color={colors.muted} />
                                <Text style={styles.emptyText}>Bu klasör boş</Text>
                            </View>
                        )
                    )}
                </ScrollView>
            )}
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
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    itemCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        padding: 14, marginBottom: 10, borderRadius: 14,
        borderWidth: 1, borderColor: colors.border
    },
    itemIcon: {
        width: 44, height: 44, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', marginRight: 14
    },
    itemInfo: { flex: 1, marginRight: 8 },
    itemName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    itemSubtext: { color: colors.muted, fontSize: 12, marginTop: 3 },
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: colors.muted, fontSize: 16, marginTop: 16 }
});
