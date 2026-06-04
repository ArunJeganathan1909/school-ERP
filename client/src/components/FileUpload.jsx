import { useRef, useState } from 'react';
import { uploadFile } from '../utils/supabase';
import './FileUpload.css';

const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
];

const MAX_SIZE_MB = 20;

const FILE_ICONS = {
    'application/pdf':    { icon: '📄', label: 'PDF',   color: '#DC2626', bg: '#FEF2F2' },
    'application/msword': { icon: '📝', label: 'DOC',   color: '#2563EB', bg: '#EFF6FF' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        { icon: '📝', label: 'DOCX',  color: '#2563EB', bg: '#EFF6FF' },
    'application/vnd.ms-powerpoint':
        { icon: '📊', label: 'PPT',   color: '#D97706', bg: '#FFFBEB' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        { icon: '📊', label: 'PPTX',  color: '#D97706', bg: '#FFFBEB' },
    'application/vnd.ms-excel':
        { icon: '📈', label: 'XLS',   color: '#059669', bg: '#ECFDF5' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        { icon: '📈', label: 'XLSX',  color: '#059669', bg: '#ECFDF5' },
    'image/jpeg':         { icon: '🖼',  label: 'IMG',   color: '#7C3AED', bg: '#F5F3FF' },
    'image/png':          { icon: '🖼',  label: 'PNG',   color: '#7C3AED', bg: '#F5F3FF' },
    'text/plain':         { icon: '📃', label: 'TXT',   color: '#6B7280', bg: '#F9FAFB' },
    'application/zip':    { icon: '🗜',  label: 'ZIP',   color: '#374151', bg: '#F3F4F6' },
};

const getFileInfo = (type) => FILE_ICONS[type] || { icon: '📎', label: 'FILE', color: '#6B7280', bg: '#F9FAFB' };

const fmtSize = (bytes) => {
    if (bytes < 1024)          return `${bytes} B`;
    if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function FileUpload({
                                       value,
                                       onChange,
                                       folder  = 'assignments',
                                       label   = 'Attachment',
                                       hint    = 'PDF, DOCX, PPTX, XLSX, images or ZIP — max 20 MB',
                                   }) {
    const inputRef    = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [progress,  setProgress]  = useState(0);
    const [error,     setError]     = useState('');
    const [dragOver,  setDragOver]  = useState(false);

    /* ── core upload logic ── */
    const handleFile = async (file) => {
        setError('');

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError(`File type not allowed. Allowed: PDF, Word, PowerPoint, Excel, images, ZIP.`);
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setError(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`);
            return;
        }

        setUploading(true);
        setProgress(10);

        try {
            const progressInterval = setInterval(() => {
                setProgress((p) => Math.min(p + 15, 85));
            }, 300);

            const { url } = await uploadFile(file, folder);

            clearInterval(progressInterval);
            setProgress(100);

            setTimeout(() => {
                setProgress(0);
                setUploading(false);
            }, 600);

            onChange(url);
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
            setUploading(false);
            setProgress(0);
        }
    };

    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const handleRemove = () => {
        onChange(null);
        setError('');
    };

    /* ── derive file name from URL ── */
    const fileName = value
        ? decodeURIComponent(value.split('/').pop().replace(/^\d+_/, ''))
        : null;

    return (
        <div className="file-upload">
            <label className="form-label">{label}</label>

            {/* Already has a file */}
            {value ? (
                <div className="file-upload__current">
                    <div className="file-upload__current-icon">📎</div>
                    <div className="file-upload__current-info">
                        <span className="file-upload__current-name" title={fileName}>
                            {fileName}
                        </span>
                        <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-upload__current-link"
                        >
                            Open file ↗
                        </a>
                    </div>
                    <div className="file-upload__current-actions">
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading}
                        >
                            Replace
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={handleRemove}
                            disabled={uploading}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                /* Drop zone */
                <div
                    className={`file-upload__dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    {uploading ? (
                        <div className="file-upload__progress-wrap">
                            <div className="file-upload__progress-icon">⬆</div>
                            <div className="file-upload__progress-label">Uploading…</div>
                            <div className="file-upload__progress-bar">
                                <div
                                    className="file-upload__progress-fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="file-upload__progress-pct">{progress}%</div>
                        </div>
                    ) : (
                        <>
                            <div className="file-upload__icon">📎</div>
                            <div className="file-upload__text">
                                <span className="file-upload__text-primary">
                                    Click to upload or drag & drop
                                </span>
                                <span className="file-upload__text-hint">{hint}</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleInputChange}
                style={{ display: 'none' }}
            />

            {/* Error */}
            {error && (
                <div className="file-upload__error">⚠ {error}</div>
            )}

            {/* Hint text */}
            {!value && !uploading && (
                <p className="file-upload__hint">{hint}</p>
            )}
        </div>
    );
}