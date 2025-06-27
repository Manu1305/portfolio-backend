const YtDlpWrap = require('yt-dlp-wrap').default;
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const DEFAULT_COOKIES_PATH = '/home/ubuntu/cookies.txt';
const execAsync = promisify(exec);
const { uploadToS3 } = require('../config/helpers');

// Helper function to sanitize filename - Enhanced for Unicode handling
const sanitizeFilename = (filename) => {
    return filename
        // Remove invalid characters for file systems
        .replace(/[<>:"/\\|?*]/g, '')
        // Remove emojis and symbols
        .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        // Replace problematic Unicode characters with ASCII equivalents or remove them
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
        // Convert to ASCII-safe characters where possible
        .replace(/[^\x20-\x7E]/g, '') // Keep only printable ASCII characters
        // Clean up spaces
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .trim()
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        || `video_${Date.now()}`; // Fallback if everything gets removed
};

// Helper function to check if file exists (with retry mechanism)
async function waitForFile(filePath, maxRetries = 10, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (fs.existsSync(filePath)) {
                return true;
            }
        } catch (error) {
            console.log(`Attempt ${i + 1}: File check failed, retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
}

// Get video info first to get the title
const getVideoInfo = async (url) => {
    try {
        const ytDlpWrap = new YtDlpWrap();
        const options = [
            url,
            '--dump-json',
            '--no-playlist',
            '--skip-download'
        ];

        const result = await ytDlpWrap.execPromise(options);
        const videoInfo = JSON.parse(result);
        return {
            title: videoInfo.title,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader
        };
    } catch (error) {
        console.error('Error getting video info:', error);
        return null;
    }
};

const downloadYtVideo = async (url) => {
    const outputPath = './downloads';
    const ytDlpWrap = new YtDlpWrap();

    try {
        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Get video info first
        console.log('Getting video information...');
        const videoInfo = await getVideoInfo(url);
        if (!videoInfo) {
            throw new Error('Could not retrieve video information');
        }

        console.log(`Video Title: ${videoInfo.title}`);

        // Generate a unique filename with better sanitization
        const timestamp = Date.now();
        const safeTitle = sanitizeFilename(videoInfo.title) || `video_${timestamp}`;
        const filename = `${safeTitle}_${timestamp}`;
        const outputTemplate = path.join(outputPath, `${filename}.%(ext)s`);

        // Enhanced download options
        const options = [
            url,
            '-o', outputTemplate,
            '--no-playlist',
            '--format', 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--restrict-filenames',
            '--ignore-errors',
            '--no-check-certificate',
            '--sleep-interval', '1',
            '--max-sleep-interval', '5',
            '--extractor-retries', '3',
            '--socket-timeout', '30'
        ];

        console.log('Starting download...');
        console.log('Download options:', options);

        const result = await ytDlpWrap.execPromise(options);
        console.log('yt-dlp output:', result);

        // Wait for file system sync
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Find the downloaded file
        const files = fs.readdirSync(outputPath);
        console.log('Files in download directory:', files);

        // Look for the file that matches our expected pattern
        const expectedPattern = `${filename}.mp4`;
        console.log('Looking for file pattern:', expectedPattern);

        let downloadedFile = null;

        // First, try to find exact match
        downloadedFile = files.find(file => file === expectedPattern);

        // If not found, look for files created in the last 30 seconds
        if (!downloadedFile) {
            const now = Date.now();
            let latestTime = 0;

            for (const file of files) {
                const filePath = path.join(outputPath, file);
                try {
                    const stats = fs.statSync(filePath);
                    const ageInSeconds = (now - stats.mtimeMs) / 1000;

                    // Only consider files created in the last 30 seconds
                    if (ageInSeconds <= 30 && stats.mtimeMs > latestTime) {
                        latestTime = stats.mtimeMs;
                        downloadedFile = file;
                    }
                } catch (error) {
                    console.log('Error checking file stats for:', file, error.message);
                    continue;
                }
            }
        }

        if (!downloadedFile) {
            throw new Error('No recently downloaded file found');
        }

        console.log('Selected downloaded file:', downloadedFile);

        const filePath = path.join(outputPath, downloadedFile);
        console.log('Downloaded file path:', filePath);

        // Verify file exists and has content
        if (!fs.existsSync(filePath)) {
            throw new Error('Downloaded file does not exist');
        }

        const fileStats = fs.statSync(filePath);
        if (fileStats.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        console.log(`File downloaded successfully: ${downloadedFile} (${fileStats.size} bytes)`);

        // Upload to S3
        const sanitizedName = sanitizeFilename(downloadedFile);
        const s3Key = `videos/${sanitizedName}`;

        console.log('Uploading to S3...');
        const s3Url = await uploadToS3(filePath, s3Key);

        // Clean up local file
        fs.unlinkSync(filePath);

        return {
            success: true,
            message: 'Video downloaded and uploaded to S3 successfully',
            fileName: sanitizedName,
            s3Url,
            videoInfo
        };

    } catch (error) {
        console.error('Download error:', error);

        // Clean up any partial files (but not our successfully downloaded file)
        try {
            const files = fs.readdirSync(outputPath);
            const now = Date.now();

            for (const file of files) {
                // Skip the file we just successfully processed
                if (file === downloadedFile) {
                    continue;
                }

                const filePath = path.join(outputPath, file);
                try {
                    const stats = fs.statSync(filePath);
                    const ageInMinutes = (now - stats.mtimeMs) / (1000 * 60);

                    // Only remove files older than 1 hour to avoid removing user files
                    if (ageInMinutes > 60) {
                        console.log('Cleaning up old file:', file);
                        // Uncomment the next line if you want to actually delete old files
                        // fs.unlinkSync(filePath);
                    }
                } catch (statError) {
                    console.log('Could not check file stats for cleanup:', file);
                }
            }
        } catch (cleanupError) {
            console.error('Error during cleanup (non-critical):', cleanupError.message);
        }

        return {
            success: false,
            error: error.message || 'Download failed'
        };
    }
};

// Alternative function with better error handling and cookies
async function downloadYtVideoWithCookies(url, platform = 'youtube', cookiesPath = null) {
    try {
        const ytDlpWrap = new YtDlpWrap();
        const outputPath = './downloads';

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Get video info first
        const videoInfo = await getVideoInfo(url);
        if (!videoInfo) {
            throw new Error('Could not retrieve video information');
        }

        const timestamp = Date.now();
        const safeTitle = sanitizeFilename(videoInfo.title) || `video_${timestamp}`;
        const filename = `${safeTitle}_${timestamp}`;
        const outputTemplate = path.join(outputPath, `${filename}.%(ext)s`);

        const downloadOptions = [
            url,
            '-o', outputTemplate,
            '--no-playlist',
            '--format', 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--sleep-interval', '1',
            '--max-sleep-interval', '5',
            '--extractor-retries', '3',
            '--ignore-errors',
            '--restrict-filenames',
            '--no-check-certificate',
            '--socket-timeout', '30'
        ];

        // Add cookie support if cookies file exists
        if (cookiesPath && fs.existsSync(cookiesPath)) {
            downloadOptions.push('--cookies', cookiesPath);
            console.log('Using cookies from:', cookiesPath);
        }

        console.log('Starting download with cookies...');
        const result = await ytDlpWrap.execPromise(downloadOptions);
        console.log('Download result:', result);

        // Wait for file system
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Find the downloaded file
        const files = fs.readdirSync(outputPath);
        let downloadedFile = null;
        let latestTime = 0;

        for (const file of files) {
            const filePath = path.join(outputPath, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs > latestTime) {
                latestTime = stats.mtimeMs;
                downloadedFile = file;
            }
        }

        if (!downloadedFile) {
            throw new Error('No downloaded file found');
        }

        const filePath = path.join(outputPath, downloadedFile);

        // Verify file
        if (!fs.existsSync(filePath)) {
            throw new Error('Downloaded file does not exist');
        }

        const fileStats = fs.statSync(filePath);
        if (fileStats.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        return {
            success: true,
            message: 'Video downloaded successfully',
            outputPath: outputPath,
            fileName: downloadedFile,
            filePath: filePath,
            videoInfo
        };

    } catch (error) {
        console.error('Download error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    downloadYtVideo,
    downloadYtVideoWithCookies
};