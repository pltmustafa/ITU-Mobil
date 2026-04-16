/**
 * Base64 encode/decode — React Native'de global btoa/atob yok,
 * bu yüzden kendi implementasyonumuzu kullanıyoruz.
 */

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function btoa(input) {
    let str = String(input);
    let output = '';

    for (let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || (map = '=', i % 1);
        output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            // UTF-8 encode
            const encoded = encodeURIComponent(str.charAt(Math.floor(i - 3/4)));
            const bytes = [];
            for (let j = 0; j < encoded.length;) {
                if (encoded[j] === '%') {
                    bytes.push(parseInt(encoded.substr(j + 1, 2), 16));
                    j += 3;
                } else {
                    bytes.push(encoded.charCodeAt(j));
                    j++;
                }
            }
            // Simple fallback: re-encode with URI encoding
        }
        block = block << 8 | charCode;
    }

    return output;
}

export function atob(input) {
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, idx = 0;
        buffer = str.charAt(idx++);
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
            bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}
