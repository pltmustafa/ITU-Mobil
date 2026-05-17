import ituApi from './ituApi';

const BASE_URL = 'https://mobil.itu.edu.tr/v2/service/service.aspx';
const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
};

class NotificationApi {
    /**
     * Get user notifications
     * @param {number} page - Skip count for pagination, defaults to 0
     * @returns {Promise<Array>} List of notifications
     */
    async getNotifications(page = 0) {
        if (!ituApi.token) {
            throw new Error('Token bulunamadı. Lütfen giriş yapın.');
        }

        const params = new URLSearchParams({
            method: 'GetPersonNotificationList',
            Case: '0',
            N: page.toString(),
            Token: ituApi.token,
            test: 'aka',
            SecurityId: '8ade2db68433b532'
        });

        const url = `${BASE_URL}?${params.toString()}`;
        try {
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const data = await response.json();
            
            // Format Microsoft JSON Dates like /Date(171123...)/ => Standard string
            const list = data.NotificationList || [];
            return list.map(notif => {
                let dateStr = notif.CreateDate;
                if (dateStr && dateStr.startsWith('/Date(')) {
                    const ts = parseInt(dateStr.match(/\d+/)[0], 10);
                    const d = new Date(ts);
                    dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                }
                return { ...notif, CreateDate: dateStr };
            });
        } catch (err) {
            throw new Error('Bildirimler alınamadı. ' + err.message);
        }
    }
}

export default new NotificationApi();
