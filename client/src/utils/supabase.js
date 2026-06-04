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
    // Split extension from base name
    const dotIndex  = file.name.lastIndexOf('.');
    const ext       = dotIndex !== -1 ? file.name.slice(dotIndex + 1).toLowerCase() : 'bin';
    const baseName  = dotIndex !== -1 ? file.name.slice(0, dotIndex) : file.name;

    // Sanitize: lowercase, replace anything that isn't a-z 0-9 or hyphen with hyphen
    const safeName  = baseName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')   // replace special chars with hyphens
            .replace(/-+/g, '-')           // collapse multiple hyphens
            .replace(/^-|-$/g, '')         // trim leading/trailing hyphens
            .slice(0, 50)                  // limit length
        || 'file';                     // fallback if empty

    const timestamp = Date.now();
    // const path      = `${folder}/${timestamp}-${safeName}.${ext}`;
    const path      = `${timestamp}-${safeName}.${ext}`;

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
        const urlObj = new URL(url);
        const parts  = urlObj.pathname.split('/assignments/');
        return parts.length > 1 ? parts[1] : null;
    } catch {
        return null;
    }
}