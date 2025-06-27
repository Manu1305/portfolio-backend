const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();

console.log('Initializing AWS S3 with environment variables...');
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

if (!BUCKET_NAME) {
    console.error('❌ AWS_S3_BUCKET is not defined in your .env file.');
}

const uploadToS3 = async (filePath, s3Key, contentType = 'video/mp4') => {
    try {
        console.log(`🔍 Reading file from path: ${filePath}`);
        const fileContent = fs.readFileSync(filePath);

        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
            ContentDisposition: 'attachment'
            // Removed ACL parameter - let bucket policy handle permissions
        };

        console.log(`📤 Uploading ${s3Key} to S3 bucket: ${BUCKET_NAME}...`);

        const uploadResult = await s3.upload(params).promise();

        console.log('✅ Upload successful!');
        console.log('S3 Response:', uploadResult);

        // Use the Location from the upload result, or construct URL
        const publicUrl = uploadResult.Location || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
        console.log('🌐 Public URL:', publicUrl);

        return publicUrl;
    } catch (err) {
        console.error('❌ S3 upload failed:', err.message);
        throw err;
    }
};

// Alternative function with presigned URL for temporary access
const getPresignedUrl = async (s3Key, expiresIn = 3600) => {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Expires: expiresIn ,
            ResponseContentDisposition: 'attachment'// URL expires in 1 hour by default
        };

        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (err) {
        console.error('❌ Failed to generate presigned URL:', err.message);
        throw err;
    }
};

// New function to download file from S3 to local filesystem
const downloadFromS3 = async (s3Key, localFilePath = null) => {
    try {
        console.log(`📥 Downloading ${s3Key} from S3 bucket: ${BUCKET_NAME}...`);

        // If no local path specified, create one in downloads folder
        if (!localFilePath) {
            const downloadDir = './downloads';
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            // Extract filename from S3 key
            const filename = path.basename(s3Key);
            localFilePath = path.join(downloadDir, filename);
        }

        // Ensure the directory exists
        const dir = path.dirname(localFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key
        };

        console.log(`🔍 Fetching object from S3...`);
        const s3Object = await s3.getObject(params).promise();

        console.log(`💾 Writing file to: ${localFilePath}`);
        fs.writeFileSync(localFilePath, s3Object.Body);

        const stats = fs.statSync(localFilePath);
        console.log(`✅ Download successful! File size: ${stats.size} bytes`);

        return {
            success: true,
            localFilePath: localFilePath,
            fileSize: stats.size,
            message: 'File downloaded successfully from S3'
        };

    } catch (err) {
        console.error('❌ S3 download failed:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
};

// Function to download file from S3 using S3 URL (extracts key from URL)
const downloadFromS3Url = async (s3Url, localFilePath = null) => {
    try {
        // Extract S3 key from URL
        let s3Key;

        // Handle different S3 URL formats
        if (s3Url.includes(`${BUCKET_NAME}.s3.`)) {
            // Format: https://bucket.s3.region.amazonaws.com/key
            const urlParts = s3Url.split(`${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`);
            s3Key = urlParts[1];
        } else if (s3Url.includes('s3.amazonaws.com')) {
            // Format: https://s3.amazonaws.com/bucket/key
            const urlParts = s3Url.split(`s3.amazonaws.com/${BUCKET_NAME}/`);
            s3Key = urlParts[1];
        } else {
            throw new Error('Invalid S3 URL format');
        }

        if (!s3Key) {
            throw new Error('Could not extract S3 key from URL');
        }

        console.log(`🔑 Extracted S3 key: ${s3Key}`);
        return await downloadFromS3(s3Key, localFilePath);

    } catch (err) {
        console.error('❌ Failed to download from S3 URL:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
};

// Function to check if file exists in S3
const checkS3FileExists = async (s3Key) => {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key
        };

        await s3.headObject(params).promise();
        return true;
    } catch (err) {
        if (err.code === 'NotFound') {
            return false;
        }
        throw err;
    }
};

// Function to delete file from S3
const deleteFromS3 = async (s3Key) => {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key
        };

        await s3.deleteObject(params).promise();
        console.log(`🗑️ File deleted from S3: ${s3Key}`);
        return true;
    } catch (err) {
        console.error('❌ Failed to delete from S3:', err.message);
        throw err;
    }
};

module.exports = {
    uploadToS3,
    getPresignedUrl,
    downloadFromS3,
    downloadFromS3Url,
    checkS3FileExists,
    deleteFromS3
};