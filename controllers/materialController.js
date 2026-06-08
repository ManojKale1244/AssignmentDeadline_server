const Material = require('../models/Material')
const User = require('../models/User')
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary')
const { logActivity } = require('../utils/activityLog')
const https = require('https')
const http = require('http')

const createMaterial = async (req, res, next) => {
    try {
        const { title, category, subjectId, class: materialClass, division } = req.body

        if (!title || !category || !subjectId || !materialClass || !division) {
            return res.status(400).json({
                message: 'Title, category, subject, class, and division required',
            })
        }

        if (!req.file) {
            return res.status(400).json({ message: 'File required' })
        }

        const uploadResult = await uploadBuffer(req.file.buffer, {
            folder: 'edutrack/materials',
            resource_type: 'auto',
        })

        const material = await Material.create({
            title,
            category,
            subjectId,
            fileUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            fileType: uploadResult.format || req.file.mimetype || '',
            uploadedBy: req.user.id,
            class: materialClass,
            division,
        })

        await logActivity(req.user.id, 'create', 'Material', material._id)

        res.status(201).json({ material })
    } catch (error) {
        next(error)
    }
}

const listMaterials = async (req, res, next) => {
    try {
        const { subjectId, category, class: materialClass, division, q } = req.query
        const query = {}

        if (subjectId) query.subjectId = subjectId
        if (category) query.category = category
        if (materialClass) query.class = materialClass
        if (division) query.division = division
        if (q) {
            const regex = new RegExp(String(q), 'i')
            query.title = regex
        }

        const materials = await Material.find(query)
            .populate('subjectId', 'name code')
            .sort({ createdAt: -1 })
            .limit(200)

        res.json({ materials })
    } catch (error) {
        next(error)
    }
}

const getMaterial = async (req, res, next) => {
    try {
        const material = await Material.findById(req.params.id).populate(
            'subjectId',
            'name code'
        )
        if (!material) {
            return res.status(404).json({ message: 'Material not found' })
        }

        res.json({ material })
    } catch (error) {
        next(error)
    }
}

const deleteMaterial = async (req, res, next) => {
    try {
        const material = await Material.findById(req.params.id)
        if (!material) {
            return res.status(404).json({ message: 'Material not found' })
        }

        if (material.publicId) {
            await deleteAsset(material.publicId)
        }

        await material.deleteOne()
        await logActivity(req.user.id, 'delete', 'Material', material._id)

        res.json({ message: 'Material deleted' })
    } catch (error) {
        next(error)
    }
}
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

const downloadMaterialAttachment = async (req, res, next) => {
    try {
        const material = await Material.findById(req.params.id)
        if (!material) {
            return res.status(404).json({ message: 'Material not found' })
        }

        // Access control: if user is student, enforce class+division match
        if (req.user.role === 'student') {
            const user = await User.findById(req.user.id)
            if (!user) return res.status(404).json({ message: 'User not found' })
            if (material.class !== user.class || material.division !== user.division) {
                return res.status(403).json({ message: 'Access denied: material not in your class/division' })
            }
        }

        if (!material.fileUrl) {
            return res.status(404).json({ message: 'No file found' })
        }

        const fileUrl = material.fileUrl
        const publicId = material.publicId
        const action = req.query.action || 'download'

        // Build filename from material title
        const ext = material.fileType
            ? '.' + material.fileType.replace(/^\./, '')
            : ''
        const safeName = (material.title || 'material').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
        const filename = safeName + ext

        // Fetch Cloudinary resource
        try {
            const fileRes = await followRedirects(fileUrl)

            if (fileRes.statusCode === 200) {
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
                return fileRes.pipe(res)
            }

            if (fileRes.statusCode === 401 || fileRes.headers['x-cld-error'] === 'deny or ACL failure') {
                return res.status(401).json({
                    message: 'PDF/ZIP delivery is restricted on your Cloudinary account. Please go to your Cloudinary Console > Settings > Security > Restricted media types, and ensure "Allow delivery of PDF and ZIP files" is enabled.'
                })
            }

            if (publicId) {
                const altUrl = fileUrl
                    .replace('/image/upload/', '/raw/upload/')
                    .replace('/video/upload/', '/raw/upload/')

                const altRes = await followRedirects(altUrl)
                if (altRes.statusCode === 200) {
                    const contentType = altRes.headers['content-type'] || 'application/octet-stream'
                    res.setHeader('Content-Type', contentType)
                    res.setHeader(
                        'Content-Disposition',
                        action === 'download'
                            ? `attachment; filename="${filename}"`
                            : `inline; filename="${filename}"`
                    )
                    if (altRes.headers['content-length']) {
                        res.setHeader('Content-Length', altRes.headers['content-length'])
                    }
                    return altRes.pipe(res)
                }

                if (altRes.statusCode === 401 || altRes.headers['x-cld-error'] === 'deny or ACL failure') {
                    return res.status(401).json({
                        message: 'PDF/ZIP delivery is restricted on your Cloudinary account. Please go to your Cloudinary Console > Settings > Security > Restricted media types, and ensure "Allow delivery of PDF and ZIP files" is enabled.'
                    })
                }
            }

            return res.status(502).json({ message: 'Failed to fetch file from storage' })
        } catch (fetchErr) {
            console.error('Material proxy download error:', fetchErr.message)
            return res.status(502).json({ message: 'Failed to fetch file' })
        }
    } catch (error) {
        next(error)
    }
}

module.exports = {
    createMaterial,
    listMaterials,
    getMaterial,
    deleteMaterial,
    downloadMaterialAttachment,
}

