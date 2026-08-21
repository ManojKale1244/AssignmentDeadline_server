const path = require('path')
const { getPresignedDownloadUrl } = require('./r2')

/**
 * Extract the R2 object key from a public R2 URL.
 * e.g. "https://pub-xxx.r2.dev/edutrack/materials/abc.pdf" → "edutrack/materials/abc.pdf"
 */
const extractKeyFromUrl = (fileUrl) => {
    try {
        const url = new URL(fileUrl)
        // Remove leading slash from pathname
        return url.pathname.replace(/^\/+/, '')
    } catch {
        return null
    }
}

/**
 * Redirect client to presigned URL (or Cloudinary URL) for download/view.
 * Supports both legacy Cloudinary assets and new Cloudflare R2 assets.
 *
 * @param {Object} options
 * @param {string} options.fileUrl   - Stored file URL
 * @param {string} options.publicId  - Public ID or R2 object key
 * @param {string} options.filename  - Sanitized filename for Content-Disposition
 * @param {string} options.action    - 'download' | 'view'
 * @param {Object} res              - Express response object
 */
const proxyFile = async ({ fileUrl, publicId, filename, action = 'download' }, res) => {
    try {
        const isCloudinaryUrl = fileUrl && (fileUrl.includes('cloudinary.com') || fileUrl.includes('res.cloudinary.com'))
        const key = publicId || extractKeyFromUrl(fileUrl)
        const isLegacyCloudinaryKey = key && !path.extname(key) && !fileUrl?.includes('r2.')

        // Handle Cloudinary files (by URL or legacy publicId)
        if (isCloudinaryUrl || isLegacyCloudinaryKey) {
            let redirectUrl = fileUrl

            if (!redirectUrl && isLegacyCloudinaryKey) {
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo'
                redirectUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${key}`
            }

            if (redirectUrl && action === 'download' && !redirectUrl.includes('fl_attachment')) {
                redirectUrl = redirectUrl.includes('/upload/')
                    ? redirectUrl.replace('/upload/', '/upload/fl_attachment/')
                    : redirectUrl
            }

            if (redirectUrl) {
                return res.redirect(redirectUrl)
            }
        }

        if (!key) {
            if (fileUrl) return res.redirect(fileUrl)
            return res.status(404).json({ message: 'File key not found' })
        }

        // Generate presigned URL with Content-Disposition header for Cloudflare R2
        const presignedUrl = await getPresignedDownloadUrl(key, filename, action)

        // 302 redirect → browser fetches file directly from R2
        return res.redirect(presignedUrl)
    } catch (err) {
        console.error('File redirect error:', err.message)
        if (fileUrl) return res.redirect(fileUrl)
        return res.status(502).json({ message: 'Failed to generate download link' })
    }
}

const buildFilename = (title, fileType) => {
    let ext = ''
    if (fileType && !fileType.includes('/')) {
        ext = '.' + fileType.replace(/^\./, '')
    }
    const safeName = (title || 'file').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
    return safeName + ext
}

module.exports = { proxyFile, buildFilename }
