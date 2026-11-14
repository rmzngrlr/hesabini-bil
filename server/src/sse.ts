/*
 * Hesabını Bil! — Cihazlar arası canlı senkron (Server-Sent Events).
 *
 * Bir kullanıcının açık her cihazı/sekmesi `GET /api/budget/stream`'e bağlanır.
 * Veri değiştiğinde (bütçe POST'u veya vault mutasyonu) `broadcast` ile o
 * kullanıcının DİĞER cihazlarına "değişti" sinyali gider; onlar da ilgili veriyi
 * bir kez yeniden çeker. Yayın sadece gerçekten değişiklik olunca akar; boştaki
 * bağlantı yalnızca periyodik kalp atışı (heartbeat) alır -> sunucu yükü minimum.
 *
 * Tek süreç içi bellek yeterli: backend konteyneri "restart: unless-stopped" ile
 * sürekli çalışır ve tek instance'tır.
 */
import type { Response } from 'express';

export type Client = { res: Response; tabId: string };

// userId -> açık bağlantılar
const clients = new Map<number, Set<Client>>();

export const addClient = (userId: number, res: Response, tabId: string): Client => {
    const client: Client = { res, tabId };
    let set = clients.get(userId);
    if (!set) {
        set = new Set();
        clients.set(userId, set);
    }
    set.add(client);
    return client;
};

export const removeClient = (userId: number, client: Client): void => {
    const set = clients.get(userId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) clients.delete(userId);
};

/**
 * Kullanıcının açık cihazlarına olay gönderir. `exceptTabId` verilirse o sekme
 * (değişikliği yapan cihaz) atlanır -> kendi kendine echo/döngü olmaz.
 */
export const broadcast = (
    userId: number,
    payload: Record<string, unknown>,
    exceptTabId?: string
): void => {
    const set = clients.get(userId);
    if (!set) return;
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const c of set) {
        if (exceptTabId && c.tabId === exceptTabId) continue;
        try {
            c.res.write(line);
        } catch {
            /* ölü bağlantı: 'close' olayı temizler */
        }
    }
};

// Tek merkezi kalp atışı: tüm açık bağlantılara periyodik yorum satırı yazar.
// nginx/Cloudflare boşta kalan bağlantıyı kapatmasın diye (idle timeout'tan kısa).
const HEARTBEAT_MS = 25 * 1000;
setInterval(() => {
    for (const set of clients.values()) {
        for (const c of set) {
            try {
                c.res.write(': ping\n\n');
            } catch {
                /* yoksay */
            }
        }
    }
}, HEARTBEAT_MS);
