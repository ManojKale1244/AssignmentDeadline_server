const cloudinary = require('cloudinary').v2

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadBuffer = (buffer, options = {}) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) {
                return reject(error)
            }
            return resolve(result)
        })

        stream.end(buffer)
    })

const deleteAsset = async (publicId) => {
    if (!publicId) return null
    return cloudinary.uploader.destroy(publicId)
}

/**
 * Generate a signed/authenticated URL for a Cloudinary asset.
 * Works for both image and raw resource types.
 */
const getSignedUrl = (publicId, options = {}) => {
    const resourceType = options.resource_type || 'image'
    return cloudinary.url(publicId, {
        sign_url: true,
        type: 'authenticated',
        resource_type: resourceType,
        ...options,
    })
}

module.exports = {
    cloudinary,
    uploadBuffer,
    deleteAsset,
    getSignedUrl,
}
