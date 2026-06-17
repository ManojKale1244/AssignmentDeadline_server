const https = require('https')
const http = require('http')

/**
 * Follow redirects for http/https.get (Node built-in doesn't follow them).
 * Shared utility — used by both studentController and materialController.
 */
const followRedirects = (url, maxRedirects = 5) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http

        protocol.get(url, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
                const redirectUrl = response.headers.location.startsWith('http')
                    ? response.headers.location
                    : new URL(response.headers.location, url).href
                return resolve(followRedirects(redirectUrl, maxRedirects - 1))
            }
            resolve(response)
        }).on('error', reject)
    })
}

const CLD_RESTRICTED_MSG =
    'PDF/ZIP delivery is restricted on your Cloudinary account. Please go to your Cloudinary Console > Settings > Security > Restricted media types, and ensure "Allow delivery of PDF and ZIP files" is enabled.'

/**
 * Proxy a Cloudinary file through the server.
 * Handles redirect-following, alternative URL formats (raw vs image),
 * and Cloudinary ACL errors.
 *
 * @param {Object} options
 * @param {string} options.fileUrl   - The stored Cloudinary URL
 * @param {string} options.publicId  - Cloudinary public_id (for alt URL fallback)
 * @param {string} options.filename  - Sanitized filename for Content-Disposition
 * @param {string} options.action    - 'download' | 'view'
 * @param {Object} res              - Express response object
 */
const proxyCloudinaryFile = async ({ fileUrl, publicId, filename, action = 'download' }, res) => {
    const setHeaders = (fileRes) => {
        const contentType = fileRes.headers['content-type'] || 'application/octet-stream'
        res.setHeader('Content-Type', contentType)
        res.setHeader(
            'Content-Disposition',
            action === 'download'
                ? `attachment; filename="${filename}"`
                : `inline; filename="${filename}"`
        )
        if (fileRes.headers['content-length']) {
            res.setHeader('Content-Length', fileRes.headers['content-length'])
        }
    }

    const isAclError = (fileRes) =>
        fileRes.statusCode === 401 || fileRes.headers['x-cld-error'] === 'deny or ACL failure'

    try {
        // Attempt 1: use the stored URL
        const fileRes = await followRedirects(fileUrl)

        if (fileRes.statusCode === 200) {
            setHeaders(fileRes)
            return fileRes.pipe(res)
        }

        if (isAclError(fileRes)) {
            return res.status(401).json({ message: CLD_RESTRICTED_MSG })
        }

        // Attempt 2: try alternative Cloudinary resource type (/raw/upload/)
        if (publicId) {
            const altUrl = fileUrl
                .replace('/image/upload/', '/raw/upload/')
                .replace('/video/upload/', '/raw/upload/')

            const altRes = await followRedirects(altUrl)
            if (altRes.statusCode === 200) {
                setHeaders(altRes)
                return altRes.pipe(res)
            }

            if (isAclError(altRes)) {
                return res.status(401).json({ message: CLD_RESTRICTED_MSG })
            }
        }

        return res.status(502).json({ message: 'Failed to fetch file from storage' })
    } catch (fetchErr) {
        console.error('File proxy fetch error:', fetchErr.message)
        return res.status(502).json({ message: 'Failed to fetch file' })
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

module.exports = { followRedirects, proxyCloudinaryFile, buildFilename }
