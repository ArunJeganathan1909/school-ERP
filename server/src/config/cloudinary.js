let uploadAssignment = null;
let cloudinary       = null;

try {
    const cloudinaryPkg = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    const multer = require('multer');

    // Only init if all 3 env vars are present
    if (
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY    &&
        process.env.CLOUDINARY_API_SECRET
    ) {
        cloudinaryPkg.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key:    process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const assignmentStorage = new CloudinaryStorage({
            cloudinary: cloudinaryPkg,
            params: {
                folder:          'school-erp/assignments',
                allowed_formats: ['pdf','doc','docx','png','jpg','jpeg','ppt','pptx','xlsx','zip','txt'],
                resource_type:   'auto',
            },
        });

        uploadAssignment = multer({
            storage: assignmentStorage,
            limits:  { fileSize: 20 * 1024 * 1024 },
        });

        cloudinary = cloudinaryPkg;
        console.log('✓ Cloudinary configured');
    } else {
        console.warn('⚠ Cloudinary env vars missing — file upload disabled');
    }
} catch (err) {
    console.warn('⚠ Cloudinary packages not installed — file upload disabled');
}

module.exports = { cloudinary, uploadAssignment };