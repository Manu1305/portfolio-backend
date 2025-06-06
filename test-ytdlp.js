// test-ytdlp.js - Place this file in your project root directory
const YtDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

async function testYtDlp() {
    try {
        console.log('🚀 Testing yt-dlp installation...');
        console.log('Current directory:', process.cwd());

        const ytDlpWrap = new YtDlpWrap();

        // Test 1: Check yt-dlp version
        console.log('\n1️⃣ Checking yt-dlp version...');
        try {
            const version = await ytDlpWrap.execPromise(['--version']);
            console.log('✅ yt-dlp version:', version.trim());
        } catch (error) {
            console.error('❌ yt-dlp not found or not working:', error.message);
            console.log('💡 Install yt-dlp with: pip install yt-dlp');
            return;
        }

        // Test 2: Check downloads directory
        console.log('\n2️⃣ Checking downloads directory...');
        const outputPath = path.resolve('./downloads');
        console.log('📁 Download path:', outputPath);

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
            console.log('✅ Created downloads directory');
        } else {
            console.log('✅ Downloads directory exists');
        }

        // Test 3: Try to get video info without downloading
        const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll - should always work
        console.log('\n3️⃣ Testing video info extraction...');
        console.log('🔗 Test URL:', testUrl);

        try {
            const info = await ytDlpWrap.execPromise([
                testUrl,
                '--dump-json',
                '--no-download'
            ]);

            const videoInfo = JSON.parse(info);
            console.log('✅ Video info extracted successfully');
            console.log('📹 Title:', videoInfo.title);
            console.log('⏱️  Duration:', videoInfo.duration, 'seconds');
            console.log('📊 Available formats:', videoInfo.formats?.length || 0);

        } catch (error) {
            console.error('❌ Failed to extract video info:', error.message);
            console.log('💡 This might be a network issue or the URL is blocked');
            return;
        }

        // Test 4: Try actual download (small video)
        console.log('\n4️⃣ Testing actual download...');
        const testFileName = `test_video_${Date.now()}`;

        try {
            const downloadOptions = [
                testUrl,
                '-o', `${outputPath}/${testFileName}.%(ext)s`,
                '--format', 'worst[height<=360]/worst', // Download smallest version for test
                '--no-playlist',
                '--max-filesize', '10M' // Limit file size for test
            ];

            console.log('🔽 Download command:', downloadOptions.join(' '));

            const result = await ytDlpWrap.execPromise(downloadOptions);
            console.log('✅ Download completed');

            // Check if file was created
            const files = fs.readdirSync(outputPath);
            const testFiles = files.filter(f => f.includes(testFileName));

            if (testFiles.length > 0) {
                const filePath = path.join(outputPath, testFiles[0]);
                const stats = fs.statSync(filePath);

                console.log('✅ File created:', testFiles[0]);
                console.log('📏 File size:', stats.size, 'bytes');

                // Clean up test file
                fs.unlinkSync(filePath);
                console.log('🧹 Test file cleaned up');

                console.log('\n🎉 All tests passed! Your setup is working correctly.');

            } else {
                console.error('❌ No test file found after download');
                console.log('📂 Files in downloads directory:', files);
            }

        } catch (error) {
            console.error('❌ Download test failed:', error.message);
            console.log('💡 This could be due to network issues, blocked URLs, or yt-dlp configuration');
        }

    } catch (error) {
        console.error('❌ Test failed with unexpected error:', error);
    }
}

// Add some helpful information
console.log('='.repeat(50));
console.log('🔧 YT-DLP SETUP TEST');
console.log('='.repeat(50));
console.log('This script will test if yt-dlp is properly configured.');
console.log('Make sure you have installed:');
console.log('1. pip install yt-dlp');
console.log('2. npm install yt-dlp-wrap');
console.log('='.repeat(50));

// Run the test
testYtDlp().then(() => {
    console.log('\n✨ Test completed!');
}).catch(error => {
    console.error('\n💥 Test crashed:', error);
});