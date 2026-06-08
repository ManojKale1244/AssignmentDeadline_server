const express = require('express')
const multer = require('multer')
const auth = require('../middleware/auth')
const {
    createMaterial,
    listMaterials,
    getMaterial,
    deleteMaterial,
    downloadMaterialAttachment,
} = require('../controllers/materialController')

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
})

router.get('/', auth, listMaterials)
router.get('/:id', auth, getMaterial)
router.get('/:id/download', auth, downloadMaterialAttachment)
router.post('/', auth, upload.single('file'), createMaterial)
router.delete('/:id', auth, deleteMaterial)

module.exports = router
