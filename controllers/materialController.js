const Material = require('../models/Material')
const User = require('../models/User')
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary')
const { logActivity } = require('../utils/activityLog')
const { proxyCloudinaryFile, buildFilename } = require('../utils/fileProxy')

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
            const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escaped, 'i')
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

        await proxyCloudinaryFile({
            fileUrl: material.fileUrl,
            publicId: material.publicId,
            filename: buildFilename(material.title, material.fileType),
            action: req.query.action || 'download',
        }, res)
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
