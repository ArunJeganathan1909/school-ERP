import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase env variables missing. File uploads will not work.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Upload a file to Supabase Storage.
 * @param {File}   file       — browser File object
 * @param {string} folder     — subfolder inside the bucket e.g. "assignments"
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadFile(file, folder = 'assignments') {
    const ext       = file.name.split('.').pop();
    const timestamp = Date.now();
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path      = `${folder}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
        .from('assignments')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) throw new Error(error.message);

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('assignments')
        .getPublicUrl(path);

    return {
        url:  urlData.publicUrl,
        path: path,
    };
}

/**
 * Delete a file from Supabase Storage by its path.
 * @param {string} path — the path returned by uploadFile()
 */
export async function deleteFile(path) {
    if (!path) return;
    const { error } = await supabase.storage
        .from('assignments')
        .remove([path]);
    if (error) console.warn('Failed to delete file:', error.message);
}

/**
 * Extract the storage path from a public URL.
 * Needed when deleting a file using only its URL.
 */
export function getPathFromUrl(url) {
    if (!url) return null;
    try {
        const urlObj  = new URL(url);
        const parts   = urlObj.pathname.split('/assignments/');
        return parts.length > 1 ? parts[1] : null;
    } catch {
        return null;
    }
}