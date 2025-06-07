const YtDlpWrap = require('yt-dlp-wrap').default;
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function downloadYtVideo(url, platform = 'youtube') {
    try {
        const outputPath = './downloads';

        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

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
                '--force-ipv4'
            ];

            const result = await ytDlpWrap.execPromise(downloadOptions);

            // Process result from yt-dlp-wrap
            const lines = result.split('\n').filter(line => line.trim());
            const filePath = lines[lines.length - 1].trim();

            if (fs.existsSync(filePath)) {
                return {
                    success: true,
                    message: 'Video downloaded successfully (yt-dlp-wrap)',
                    outputPath: outputPath,
                    fileName: path.basename(filePath),
                    filePath: filePath
                };
            }

        } catch (wrapError) {
            console.log('yt-dlp-wrap failed, trying direct command...');

            // Method 2: Use direct yt-dlp command (fallback)
            const command = `yt-dlp "${url}" \\
                --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \\
                --add-header "Accept-Language:en-US,en;q=0.9" \\
                --add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \\
                --sleep-interval 1 \\
                --max-sleep-interval 3 \\
                --extractor-retries 3 \\
                --fragment-retries 3 \\
                --ignore-errors \\
                --no-playlist \\
                --format "best[ext=mp4]/best" \\
                -o "${outputPath}/%(title)s.%(ext)s" \\
                --print "after_move:filepath"`;

            console.log('Executing direct yt-dlp command...');
            const { stdout, stderr } = await execAsync(command, {
                timeout: 300000, // 5 minutes timeout
                cwd: process.cwd()
            });

            if (stderr && stderr.includes('Sign in to confirm')) {
                throw new Error('YouTube bot detection - try different video or use cookies');
            }

            const lines = stdout.split('\n').filter(line => line.trim());
            const filePath = lines[lines.length - 1].trim();

            if (fs.existsSync(filePath)) {
                return {
                    success: true,
                    message: 'Video downloaded successfully (direct command)',
                    outputPath: outputPath,
                    fileName: path.basename(filePath),
                    filePath: filePath
                };
            }
        }

        // Fallback: Check for any recent files in downloads directory
        console.log('Checking for recently downloaded files...');
        const files = fs.readdirSync(outputPath);

        if (files.length > 0) {
            // Get the most recently created file
            const filesWithStats = files.map(file => ({
                name: file,
                path: path.join(outputPath, file),
                stats: fs.statSync(path.join(outputPath, file))
            }));

            const latestFile = filesWithStats.sort((a, b) =>
                b.stats.mtime.getTime() - a.stats.mtime.getTime()
            )[0];

            // Check if file was created in the last 2 minutes
            const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
            if (latestFile.stats.mtime.getTime() > twoMinutesAgo) {
                return {
                    success: true,
                    message: 'Video downloaded successfully (fallback detection)',
                    outputPath: outputPath,
                    fileName: latestFile.name,
                    filePath: latestFile.path
                };
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
            '--ignore-errors'
        ];

        // Add cookie support if cookies file exists
        if (cookiesPath && fs.existsSync(cookiesPath)) {
            downloadOptions.push('--cookies', cookiesPath);
            console.log('Using cookies from:', cookiesPath);
        }

        const result = await ytDlpWrap.execPromise(downloadOptions);

        const lines = result.split('\n').filter(line => line.trim());
        const filePath = lines[lines.length - 1].trim();
        const fileName = path.basename(filePath);

        if (!fs.existsSync(filePath)) {
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
        }

        return {
            success: true,
            message: 'Video downloaded successfully',
            outputPath: outputPath,
            fileName: fileName,
            filePath: filePath
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