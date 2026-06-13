import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase env variables missing. File uploads will not work.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── shared path builder ── */
function buildPath(file) {
    const dotIndex = file.name.lastIndexOf('.');
    const ext      = dotIndex !== -1 ? file.name.slice(dotIndex + 1).toLowerCase() : 'bin';
    const baseName = dotIndex !== -1 ? file.name.slice(0, dotIndex) : file.name;

    const safeName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'file';

    return `${Date.now()}-${safeName}.${ext}`;
}

/* ── upload to any bucket ── */
async function uploadToBucket(bucket, file) {
    const path = buildPath(file);

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error(error.message);

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return { url: urlData.publicUrl, path };
}

/**
 * Upload a teacher assignment attachment → 'assignments' bucket
 */
export async function uploadFile(file, folder = 'assignments') {
    return uploadToBucket('assignments', file);
}

/**
 * Upload a student submission file → 'submissions' bucket
 */
export async function uploadSubmissionFile(file) {
    return uploadToBucket('submissions', file);
}

/**
 * Delete a file from any Supabase bucket by its path.
 */
export async function deleteFile(path, bucket = 'assignments') {
    if (!path) return;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) console.warn('Failed to delete file:', error.message);
}

/**
 * Extract storage path from a public URL.
 */
export function getPathFromUrl(url, bucket = 'assignments') {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const parts  = urlObj.pathname.split(`/${bucket}/`);
        return parts.length > 1 ? parts[1] : null;
    } catch {
        return null;
    }
}

/**
 * Upload a lesson file (PDF, video, slide, etc.) → 'lessons' bucket
 */
export async function uploadLessonFile(file) {
    return uploadToBucket('lessons', file);
}