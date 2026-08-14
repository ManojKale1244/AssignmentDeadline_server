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
 * Redirect client to a presigned R2 URL for download/view.
 * The server only sends a tiny 302 redirect — zero file bandwidth on Render.
 *
 * @param {Object} options
 * @param {string} options.fileUrl   - The stored file URL (R2 public URL)
 * @param {string} options.publicId  - The R2 object key (preferred over extracting from URL)
 * @param {string} options.filename  - Sanitized filename for Content-Disposition
 * @param {string} options.action    - 'download' | 'view'
 * @param {Object} res              - Express response object
 */
const proxyFile = async ({ fileUrl, publicId, filename, action = 'download' }, res) => {
    try {
        // Get the R2 object key — prefer publicId, fall back to extracting from URL
        const key = publicId || extractKeyFromUrl(fileUrl)
        if (!key) {
            return res.status(404).json({ message: 'File key not found' })
        }

        // Generate presigned URL with Content-Disposition header
        const presignedUrl = await getPresignedDownloadUrl(key, filename, action)

        // 302 redirect → browser fetches file directly from R2
        return res.redirect(presignedUrl)
    } catch (err) {
        console.error('File redirect error:', err.message)
        return res.status(502).json({ message: 'Failed to generate download link' })
    }
}

/**
 * Build a safe download filename from a title and file type.
 */
const buildFilename = (title, fileType) => {
    const ext = fileType ? '.' + fileType.replace(/^\./, '') : ''
    const safeName = (title || 'file').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
    return safeName + ext
}

module.exports = { proxyFile, buildFilename }
