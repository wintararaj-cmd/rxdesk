import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { uploadToS3 } from '../config/s3';

// Ensure local upload dir exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    },
});

/**
 * Upload a file to storage (S3 or local) and return the URL
 */
export async function processFile(
    file: Express.Multer.File,
    folder: string = 'banners'
): Promise<string> {
    const filename = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    if (env.S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID) {
        // S3 Upload
        const key = await uploadToS3(filename, file.buffer, file.mimetype);
        // Return S3 URL
        return `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    } else {
        // Local Upload (Fallback)
        const localPath = path.join(uploadDir, folder);
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }

        const finalPath = path.join(uploadDir, filename);
        fs.writeFileSync(finalPath, file.buffer);

        // Return Local URL
        return `${env.API_URL}/uploads/${filename}`;
    }
}
