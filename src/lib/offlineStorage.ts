'use client';

import { openDB } from 'idb';
import type { LyricLine } from './lyrics';

const DB_NAME = 'tonal-offline-db';
const DB_VERSION = 1;

export interface OfflineTrack {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  audioBlob: Blob;
  lyrics?: {
    plain?: string | null;
    synced?: LyricLine[] | null;
  };
}

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', {
          keyPath: 'id',
        });
      }

      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', {
          keyPath: 'id',
        });
      }

      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue');
      }
    },
  });
}

export async function saveOfflineTrack(track: OfflineTrack) {
  const db = await getDb();
  await db.put('tracks', track);
}

export async function getOfflineTrack(id: string): Promise<OfflineTrack | null> {
  const db = await getDb();
  return (await db.get('tracks', id)) ?? null;
}

export async function saveOfflinePlaylist(data: any) {
  const db = await getDb();
  await db.put('playlists', data);
}

export async function getOfflinePlaylist(id: string) {
  const db = await getDb();
  return db.get('playlists', id);
}

export async function saveQueueState(queue: any[], currentIndex: number) {
  const db = await getDb();
  await db.put('queue', {
    queue,
    currentIndex,
    updatedAt: Date.now(),
  }, 'current');
}

export async function loadQueueState() {
  const db = await getDb();
  return db.get('queue', 'current');
}