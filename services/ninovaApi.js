import ituApi from './ituApi';

const BASE_URL = 'https://mobil.itu.edu.tr/v2/service/service.aspx';
const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
};

class NinovaApi {
    async getNinovaCourses() {
        if (!ituApi.token) {
            throw new Error('Token bulunamadı. Lütfen giriş yapın.');
        }

        const url = `${BASE_URL}?method=NinovaGetKisiSinifList&Token=${ituApi.token}&test=aka&SecurityId=${ituApi.securityId || '8ade2db68433b532'}`;
        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const data = await response.json();
            return data.SinifList || [];
        } catch (err) {
            console.error('[NinovaGetKisiSinifList] ERROR:', err);
            throw new Error('Ninova sınıfları alınamadı. ' + err.message);
        }
    }

    async getNinovaFiles(dersId, sinifId, caseType, pathStr = '') {
        try {
            const data = await ituApi.request({
                method: 'NinovaGetirDosyalar',
                DersId: dersId,
                SinifId: sinifId,
                Case: caseType,
                Path: pathStr
            });
            return data.DosyaList || [];
        } catch (error) {
            console.error('[NinovaGetirDosyalar] ERROR:', error);
            throw new Error('Ninova dosyaları alınamadı. ' + error.message);
        }
    }

    async getNinovaFileSystemToken() {
        try {
            const data = await ituApi.request({
                method: 'NinovaCreateFileSystemToken'
            });
            return data.Token;
        } catch (error) {
            console.error('Ninova FileSystemToken error:', error);
            throw error;
        }
    }

    async getNinovaDetail(keyValues) {
        if (!ituApi.token) {
            throw new Error('Token bulunamadı. Lütfen giriş yapın.');
        }

        const isDuyuru = keyValues.includes('DuyuruId');
        const method = isDuyuru ? 'NinovaGetirDuyuruByDuyuruId' : 'NinovaGetirOdevByOdevId';
        const url = `${BASE_URL}?method=${method}&detailQuery=1&Token=${ituApi.token}&test=aka&SecurityId=${ituApi.securityId || '8ade2db68433b532'}${keyValues}`;
        
        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const data = await response.json();
            return isDuyuru ? data.Duyuru : data.Odev;
        } catch (err) {
            throw new Error('Ninova detayı alınamadı. ' + err.message);
        }
    }

    async getNinovaHomeworks(dersId, sinifId) {
        try {
            const data = await ituApi.request({
                method: 'NinovaGetirKisiOdevler',
                DersId: dersId,
                SinifId: sinifId
            });
            return data.OdevList || [];
        } catch (error) {
            console.error('[NinovaGetirKisiOdevler] ERROR:', error);
            throw new Error('Ninova ödevleri alınamadı. ' + error.message);
        }
    }

    async getNinovaAnnouncements(dersId, sinifId) {
        try {
            const data = await ituApi.request({
                method: 'NinovaGetirKisiDuyurular',
                DersId: dersId,
                SinifId: sinifId
            });
            return data.DuyuruList || [];
        } catch (error) {
            console.error('[NinovaGetirKisiDuyurular] ERROR:', error);
            throw new Error('Ninova duyuruları alınamadı. ' + error.message);
        }
    }

}

export default new NinovaApi();
