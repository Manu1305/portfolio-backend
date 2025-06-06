const YtDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

async function downloadYtVideo(url, platform = 'youtube') {
    try {
        const ytDlpWrap = new YtDlpWrap();
        const outputPath = './downloads';

        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Download the video with a simpler approach
        const result = await ytDlpWrap.execPromise([
            url,
            '-o', `${outputPath}/%(title)s.%(ext)s`,
            '--no-playlist',
            '--format', 'best[ext=mp4]/best',
            '--print', 'after_move:filepath' // This will print the final file path
        ]);

        // Extract the file path from the output
        const lines = result.split('\n').filter(line => line.trim());
        const filePath = lines[lines.length - 1].trim();
        const fileName = path.basename(filePath);

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            // Fallback: search for files in the download directory
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

module.exports = { downloadYtVideo };