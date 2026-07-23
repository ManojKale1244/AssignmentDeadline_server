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

/**
 * Proxy a file (from R2 or any public URL) through the server.
 * Handles redirect-following and streams the file to the client.
 *
 * @param {Object} options
 * @param {string} options.fileUrl   - The stored file URL (R2 public URL or legacy Cloudinary URL)
 * @param {string} options.filename  - Sanitized filename for Content-Disposition
 * @param {string} options.action    - 'download' | 'view'
 * @param {Object} res              - Express response object
 */
const proxyFile = async ({ fileUrl, filename, action = 'download' }, res) => {
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

    try {
        const fileRes = await followRedirects(fileUrl)

        if (fileRes.statusCode === 200) {
            setHeaders(fileRes)
            return fileRes.pipe(res)
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

module.exports = { followRedirects, proxyFile, buildFilename }
