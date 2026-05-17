import ituApi from './ituApi';

const BASE_URL = 'https://mobil.itu.edu.tr/v2/service/service.aspx';
const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
};

class ObsApi {
    /**
     * Kepler Servisi İstekleri (OBS Donem, Dersler, Notlar)
     * @param {string} path - İstek atılacak kepler endpointi
     * @param {object} extraParams - Ekstra query parametreleri
     * @returns {Promise<object>} API yanıtı
     */
    async fetchKepler(path, extraParams = {}) {
        if (!ituApi.token || !ituApi.userInfo?.studentId || !ituApi.userInfo?.keplerToken) {
            throw new Error('Oturum bilgileri eksik. Lütfen tekrar giriş yapın.');
        }

        const queryParams = new URLSearchParams({
            method: 'CallKeplerService',
            path: path,
            ITUNumber: ituApi.userInfo.studentId,
            Token: ituApi.userInfo.keplerToken,
            test: 'aka',
            SecurityId: '8ade2db68433b532', // Must be the hardcoded device id
            ...extraParams
        });

        const url = `${BASE_URL}?${queryParams.toString()}`;
        
        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                console.error('[KEPLER API] Invalid JSON:', text.substring(0, 200));
                throw new Error('İTÜ Sunucularından geçersiz bir format döndü (Sunucu hatası).');
            }
        } catch (netErr) {
            throw new Error(netErr.message || 'Ağ bağlantısı hatası oluştu.');
        }
    }

    /**
     * Yemek menüsü çek (auth gerekmez)
     * @param {string} dateStr - DD/MM/YYYY formatında tarih
     * @param {number} menuType - 0 = öğle, 1 = akşam
     */
    async fetchFoodMenu(dateStr, menuType = 0) {
        const queryParams = new URLSearchParams({
            method: 'GetDailyFoodMenuByDate',
            MenuTemplateKeyId: String(menuType),
            Day: dateStr,
        });

        const url = `${BASE_URL}?${queryParams.toString()}`;

        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                console.error('[Food API] Invalid JSON:', text.substring(0, 200));
                return null;
            }
        } catch (netErr) {
            console.error('[Food API] Ağ hatası:', netErr.message);
            return null;
        }
    }

    /**
     * Bakiye ve Kota bilgilerini çeker (GetPersonalInformationV2)
     * @returns {Promise<object>} Bakiye API yanıtı
     */
    async fetchPersonalInformation() {
        if (!ituApi.token) {
            throw new Error('Oturum bilgileri eksik. Lütfen tekrar giriş yapın.');
        }

        const queryParams = new URLSearchParams({
            method: 'GetPersonalInformationV2',
            Token: ituApi.token,
            test: 'aka',
            SecurityId: '8ade2db68433b532'
        });

        const url = `${BASE_URL}?${queryParams.toString()}`;

        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                console.error('[Personal Info API] Invalid JSON:', text.substring(0, 200));
                return null;
            }
        } catch (netErr) {
            console.error('[Personal Info API] Ağ hatası:', netErr.message);
            return null;
        }
    }
}

export default new ObsApi();
