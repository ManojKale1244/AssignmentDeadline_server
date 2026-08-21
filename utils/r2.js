const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const path = require('path')
const crypto = require('crypto')

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
})

const BUCKET = process.env.R2_BUCKET_NAME
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')

/**
 * Determine content-type from the original filename or mimetype.
 */
const guessContentType = (originalname, mimetype) => {
    if (mimetype && mimetype !== 'application/octet-stream') return mimetype
    const ext = path.extname(originalname || '').toLowerCase()
    const map = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.zip': 'application/zip',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.mp4': 'video/mp4',
    }
    return map[ext] || 'application/octet-stream'
}

/**
 * Upload a buffer to Cloudflare R2.
 *
 * @param {Buffer} buffer - File contents
 * @param {Object} options
 * @param {string} options.folder        - Virtual folder path (e.g. 'edutrack/materials')
 * @param {string} [options.originalname] - Original filename for extension detection
 * @param {string} [options.mimetype]     - MIME type hint
 * @returns {Promise<{ url: string, key: string, format: string }>}
 */
const uploadBuffer = async (buffer, options = {}) => {
    const folder = (options.folder || 'edutrack').replace(/\/+$/, '')
    const originalname = options.originalname || ''
    const ext = path.extname(originalname).toLowerCase() || ''
    const uniqueId = crypto.randomUUID()
    const key = `${folder}/${uniqueId}${ext}`

    const contentType = guessContentType(originalname, options.mimetype)

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    )

    const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `https://${BUCKET}.r2.dev/${key}`
    const format = ext.replace('.', '') || ''

    return { url, key, format }
}

/**
 * Delete an object from R2 by key.
 *
 * @param {string} key - The object key (stored as publicId in the database)
 * @returns {Promise<void>}
 */
const deleteAsset = async (key) => {
    if (!key) return
    await s3.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    )
}

/**
 * Generate a presigned R2 URL for downloading or viewing a file.
 * The presigned URL includes Content-Disposition so the browser
 * downloads the file with the correct filename.
 *
 * @param {string} key      - The R2 object key (stored as publicId)
 * @param {string} filename - The desired download filename
 * @param {string} action   - 'download' or 'view'
 * @returns {Promise<string>} Presigned URL valid for 1 hour
 */
const getPresignedDownloadUrl = async (key, filename, action = 'download') => {
    const disposition = action === 'download'
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`

    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: disposition,
    })

    return getSignedUrl(s3, command, { expiresIn: 3600 })
}

module.exports = { uploadBuffer, deleteAsset, getPresignedDownloadUrl }

