const Material = require('../models/Material')
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary')
const { logActivity } = require('../utils/activityLog')

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

module.exports = {
    createMaterial,
    listMaterials,
    getMaterial,
    deleteMaterial,
}
