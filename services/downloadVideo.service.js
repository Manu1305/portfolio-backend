const YtDlpWrap = require('yt-dlp-wrap').default;
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const DEFAULT_COOKIES_PATH = '/home/ubuntu/cookies.txt';
const execAsync = promisify(exec);

// Helper function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // Remove emojis
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
}

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

async function downloadYtVideo(url, platform = 'youtube') {
    try {
        const outputPath = './downloads';
        const cookiesPath = DEFAULT_COOKIES_PATH;
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        const useCookies = isYouTube && fs.existsSync(cookiesPath);

        // Create downloads directory if needed
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Get list of files before download
        const filesBefore = fs.existsSync(outputPath) ? fs.readdirSync(outputPath) : [];

        // Method 1: Try with yt-dlp-wrap first
        try {
            console.log('Trying yt-dlp-wrap method...');
            const ytDlpWrap = new YtDlpWrap();

            const downloadOptions = [
                url,
                '-o', `${outputPath}/%(title)s.%(ext)s`,
                '--no-playlist',
                '--format', 'best[ext=mp4]/best',
                '--print', 'after_move:filepath',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--add-header', 'Accept-Language:en-US,en;q=0.9',
                '--sleep-interval', '1',
                '--max-sleep-interval', '3',
                '--extractor-retries', '3',
                '--ignore-errors',
                '--force-ipv4',
                '--restrict-filenames'
            ];

            // ADD COOKIES SUPPORT HERE
            if (useCookies) {
                console.log(`Using cookies from: ${cookiesPath}`);
                downloadOptions.push('--cookies', cookiesPath);
            }

            const result = await ytDlpWrap.execPromise(downloadOptions);

            // Wait a bit for file system to catch up
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check for new files in directory
            const filesAfter = fs.readdirSync(outputPath);
            const newFiles = filesAfter.filter(file => !filesBefore.includes(file));

            if (newFiles.length > 0) {
                const downloadedFile = newFiles[0];
                const filePath = path.join(outputPath, downloadedFile);

                if (fs.existsSync(filePath)) {
                    return {
                        success: true,
                        message: 'Video downloaded successfully (yt-dlp-wrap)',
                        outputPath: outputPath,
                        fileName: downloadedFile,
                        filePath: filePath
                    };
                }
            }

            // Fallback: Try to parse the result output
            const lines = result.split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.includes(outputPath) && (line.includes('.mp4') || line.includes('.webm') || line.includes('.mkv'))) {
                    const possiblePath = line.trim();
                    if (fs.existsSync(possiblePath)) {
                        return {
                            success: true,
                            message: 'Video downloaded successfully (yt-dlp-wrap)',
                            outputPath: outputPath,
                            fileName: path.basename(possiblePath),
                            filePath: possiblePath
                        };
                    }
                }
            }

        } catch (wrapError) {
            console.log('yt-dlp-wrap failed, trying direct command...', wrapError.message);

            // Method 2: Use direct yt-dlp command (fallback)
            let command = `yt-dlp "${url}" `;

            // ADD COOKIES TO DIRECT COMMAND
            if (useCookies) {
                command += `--cookies "${cookiesPath}" `;
            }

            command += `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
                `--add-header "Accept-Language:en-US,en;q=0.9" ` +
                `--add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" ` +
                `--sleep-interval 1 ` +
                `--max-sleep-interval 3 ` +
                `--extractor-retries 3 ` +
                `--fragment-retries 3 ` +
                `--ignore-errors ` +
                `--no-playlist ` +
                `--format "best[ext=mp4]/best" ` +
                `--restrict-filenames ` +
                `-o "${outputPath}/%(title)s.%(ext)s" ` +
                `--print "after_move:filepath"`;

            console.log('Executing direct yt-dlp command...');
            const { stdout, stderr } = await execAsync(command, {
                timeout: 300000,
                cwd: process.cwd()
            });

            if (stderr && stderr.includes('Sign in to confirm')) {
                throw new Error('YouTube bot detection - try different video or use cookies');
            }

            // Wait a bit for file system to catch up
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check for new files
            const filesAfterDirect = fs.readdirSync(outputPath);
            const newFilesAfterDirect = filesAfterDirect.filter(file => !filesBefore.includes(file));

            if (newFilesAfterDirect.length > 0) {
                const downloadedFile = newFilesAfterDirect[0];
                const filePath = path.join(outputPath, downloadedFile);

                return {
                    success: true,
                    message: 'Video downloaded successfully (direct command)',
                    outputPath: outputPath,
                    fileName: downloadedFile,
                    filePath: filePath
                };
            }
        }

        // Final fallback: Check for any recent files in downloads directory
        console.log('Checking for recently downloaded files...');
        const files = fs.readdirSync(outputPath);

        if (files.length > 0) {
            // Get the most recently created file
            const filesWithStats = [];

            for (const file of files) {
                try {
                    const filePath = path.join(outputPath, file);
                    const stats = fs.statSync(filePath);
                    filesWithStats.push({
                        name: file,
                        path: filePath,
                        stats: stats
                    });
                } catch (statError) {
                    console.log(`Could not stat file ${file}:`, statError.message);
                    // Continue with other files
                    continue;
                }
            }

            if (filesWithStats.length > 0) {
                const latestFile = filesWithStats.sort((a, b) =>
                    b.stats.mtime.getTime() - a.stats.mtime.getTime()
                )[0];

                // Check if file was created in the last 5 minutes
                const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                if (latestFile.stats.mtime.getTime() > fiveMinutesAgo) {
                    return {
                        success: true,
                        message: 'Video downloaded successfully (fallback detection)',
                        outputPath: outputPath,
                        fileName: latestFile.name,
                        filePath: latestFile.path
                    };
                }
            }
        }

        throw new Error('No downloaded file found after all attempts');

    } catch (error) {
        console.error('Download error:', error);

        // Check if it's the bot detection error
        if (error.message && error.message.includes('Sign in to confirm you\'re not a bot')) {
            return {
                success: false,
                error: 'YouTube has detected automated access. This is common on cloud servers. Try using a different video URL or implement cookie authentication.'
            };
        }

        return {
            success: false,
            error: error.message
        };
    }
}

// Alternative function with cookie support (if you can provide cookies)
async function downloadYtVideoWithCookies(url, platform = 'youtube', cookiesPath = null) {
    try {
        const ytDlpWrap = new YtDlpWrap();
        const outputPath = './downloads';

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const downloadOptions = [
            url,
            '-o', `${outputPath}/%(title)s.%(ext)s`,
            '--no-playlist',
            '--format', 'best[ext=mp4]/best',
            '--print', 'after_move:filepath',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--sleep-interval', '1',
            '--extractor-retries', '3',
            '--ignore-errors',
            '--restrict-filenames' // Add this to handle special characters
        ];

        // Add cookie support if cookies file exists
        if (cookiesPath && fs.existsSync(cookiesPath)) {
            downloadOptions.push('--cookies', cookiesPath);
            console.log('Using cookies from:', cookiesPath);
        }

        const result = await ytDlpWrap.execPromise(downloadOptions);

        // Wait for file system
        await new Promise(resolve => setTimeout(resolve, 2000));

        const files = fs.readdirSync(outputPath);
        if (files.length > 0) {
            const latestFile = files[files.length - 1];
            const fallbackPath = path.join(outputPath, latestFile);

            return {
                success: true,
                message: 'Video downloaded successfully',
                outputPath: outputPath,
                fileName: latestFile,
                filePath: fallbackPath
            };
        } else {
            throw new Error('Downloaded file not found');
        }

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