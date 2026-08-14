/**
 * One-time script to configure CORS on the Cloudflare R2 bucket.
 * This allows the client (browser) to fetch files directly from R2
 * for download/view without routing through the backend server.
 *
 * Usage: node -r dotenv/config setup-r2-cors.js
 */
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3')

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME

async function setCors() {
    console.log(`Setting CORS rules on R2 bucket: ${BUCKET}...`)

    await s3.send(new PutBucketCorsCommand({
        Bucket: BUCKET,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD'],
                    AllowedOrigins: ['*'],
                    ExposeHeaders: ['Content-Length', 'Content-Type', 'Content-Disposition'],
                    MaxAgeSeconds: 86400,
                },
            ],
        },
    }))

    console.log('✅ CORS configured successfully! Browser can now fetch files directly from R2.')
}

setCors().catch((err) => {
    console.error('❌ Failed to set CORS:', err.message)
    process.exit(1)
})
