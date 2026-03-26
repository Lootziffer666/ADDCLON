// Offscreen document for ffmpeg.wasm video processing
// Using createFFmpegCore directly (bypassing ffmpeg.min.js wrapper)

let ffmpegCore = null;
let isLoaded = false;

// Initialize FFmpeg
async function initFFmpeg() {
    if (isLoaded) return true;

    try {
        sendProgress('loading', 0, 'Loading FFmpeg...');

        // createFFmpegCore is exposed globally by ffmpeg-core.js (loaded via script tag)
        if (typeof createFFmpegCore === 'undefined') {
            throw new Error('createFFmpegCore not found. Check if ffmpeg-core.js is included in offscreen.html');
        }

        console.log('[Offscreen] createFFmpegCore available, initializing...');

        sendProgress('loading', 30, 'Initializing FFmpeg core...');

        // Get the base URL for wasm file
        const baseURL = chrome.runtime.getURL('lib/ffmpeg');
        console.log('[Offscreen] Base URL:', baseURL);

        // Initialize FFmpeg core directly with Emscripten options
        ffmpegCore = await createFFmpegCore({
            // Tell Emscripten where to find the wasm file
            locateFile: (filename) => {
                console.log('[Offscreen] locateFile:', filename);
                if (filename.endsWith('.wasm')) {
                    return `${baseURL}/ffmpeg-core.wasm`;
                }
                return `${baseURL}/${filename}`;
            },
            // Disable stdin to prevent input prompts
            noInitialRun: true,
            noExitRuntime: true,
            // Capture stdout
            print: (message) => {
                console.log('[FFmpeg]', message);
                parseProgress(message);
                parseVideoInfo(message);
            },
            // Capture stderr
            printErr: (message) => {
                console.log('[FFmpeg ERR]', message);
                parseProgress(message);
                parseVideoInfo(message);
            }
        });

        isLoaded = true;
        sendProgress('loading', 100, 'FFmpeg loaded');
        console.log('[Offscreen] FFmpeg core loaded successfully');
        return true;
    } catch (error) {
        console.error('[Offscreen] Failed to load FFmpeg:', error);
        console.error('[Offscreen] Error stack:', error.stack);
        sendError(`Failed to load FFmpeg: ${error.message}`);
        return false;
    }
}

// Shared state for FFmpeg output parsing
let duration = 0;
let videoInfo = null;

// Reset video info before analysis
function resetVideoInfo() {
    videoInfo = {
        duration: 0,
        resolution: null,
        fps: 0,
        hasAudio: false,
        hasVideo: false,
        colorSpace: 'unknown',
        codec: null,
        audioCodec: null
    };
}

// Parse FFmpeg output for video information
function parseVideoInfo(message) {
    if (typeof message !== 'string' || !videoInfo) return;

    // Parse duration: Duration: 00:00:06.00
    if (message.includes('Duration:')) {
        const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
        if (match) {
            videoInfo.duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
        }
    }

    // Parse video stream: Stream #0:0: Video: h264, yuv420p, 1920x1080, 24 fps
    if (message.includes('Video:')) {
        videoInfo.hasVideo = true;

        // Resolution
        const resMatch = message.match(/(\d{2,5})x(\d{2,5})/);
        if (resMatch) {
            videoInfo.resolution = {
                width: parseInt(resMatch[1]),
                height: parseInt(resMatch[2])
            };
        }

        // FPS
        const fpsMatch = message.match(/(\d+(?:\.\d+)?)\s*fps/);
        if (fpsMatch) {
            videoInfo.fps = parseFloat(fpsMatch[1]);
        }

        // Color space (yuv420p, yuv444p, etc.)
        const colorMatch = message.match(/yuv\d+p\d*|rgb\d+|bgr\d+/i);
        if (colorMatch) {
            videoInfo.colorSpace = colorMatch[0];
        }

        // Codec
        const codecMatch = message.match(/Video:\s*(\w+)/);
        if (codecMatch) {
            videoInfo.codec = codecMatch[1];
        }
    }

    // Parse audio stream
    if (message.includes('Audio:')) {
        videoInfo.hasAudio = true;
        const audioCodecMatch = message.match(/Audio:\s*(\w+)/);
        if (audioCodecMatch) {
            videoInfo.audioCodec = audioCodecMatch[1];
        }
    }
}

// Parse FFmpeg output for progress
function parseProgress(message) {
    if (typeof message !== 'string') return;

    // Parse duration
    if (message.includes('Duration:')) {
        const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)/);
        if (match) {
            duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        }
    }

    // Parse time progress
    if (message.includes('time=') && duration > 0) {
        const match = message.match(/time=(\d+):(\d+):(\d+)/);
        if (match) {
            const currentTime = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
            const percent = Math.min(Math.round((currentTime / duration) * 100), 99);
            sendProgress('processing', percent, `Processing: ${percent}%`);
        }
    }
}

// Send progress update to background
function sendProgress(stage, percent, message) {
    chrome.runtime.sendMessage({
        action: 'ffmpegProgress',
        stage,
        percent,
        message
    });
}

// Send error to background
function sendError(error) {
    chrome.runtime.sendMessage({
        action: 'ffmpegError',
        error
    });
}

// Send completion to background (store in IndexedDB to avoid 64MB message limit)
async function sendComplete(resultBlob) {
    try {
        // Save to IndexedDB instead of sending base64 (which can exceed 64MB limit)
        const videoId = await saveVideo(resultBlob, {
            name: 'merged_export.mp4',
            isExport: true
        });

        console.log('[Offscreen] Saved merged video to IndexedDB:', videoId, 'size:', resultBlob.size);

        chrome.runtime.sendMessage({
            action: 'ffmpegComplete',
            videoId: videoId,
            size: resultBlob.size
        });
    } catch (error) {
        console.error('[Offscreen] Failed to save merged video:', error);
        sendError(`Failed to save result: ${error.message}`);
    }
}

// Run FFmpeg command
async function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        let argsPtr = null;
        const allocatedPtrs = [];

        function freeAllocatedMemory() {
            // Free all allocated string pointers
            for (const ptr of allocatedPtrs) {
                try {
                    ffmpegCore._free(ptr);
                } catch (e) {
                    console.warn('[Offscreen] Failed to free ptr:', e);
                }
            }
            // Free the args array pointer
            if (argsPtr !== null) {
                try {
                    ffmpegCore._free(argsPtr);
                } catch (e) {
                    console.warn('[Offscreen] Failed to free argsPtr:', e);
                }
            }
        }

        try {
            // Single-threaded version uses callMain or _main directly
            if (typeof ffmpegCore.callMain === 'function') {
                // Use callMain if available (Emscripten standard)
                console.log('[Offscreen] Using callMain');
                const ret = ffmpegCore.callMain(args);
                console.log('[Offscreen] callMain returned:', ret);
                resolve(ret);
            } else if (typeof ffmpegCore._main === 'function') {
                // Fall back to _main with manual argument passing
                console.log('[Offscreen] Using _main directly');

                // Allocate memory for arguments
                argsPtr = ffmpegCore._malloc(args.length * 4);
                args.forEach((arg, i) => {
                    const len = ffmpegCore.lengthBytesUTF8(arg) + 1;
                    const ptr = ffmpegCore._malloc(len);
                    allocatedPtrs.push(ptr); // Track for cleanup
                    ffmpegCore.stringToUTF8(arg, ptr, len);
                    ffmpegCore.setValue(argsPtr + i * 4, ptr, 'i32');
                });

                const ret = ffmpegCore._main(args.length, argsPtr);
                console.log('[Offscreen] _main returned:', ret);

                // Free memory after successful execution
                freeAllocatedMemory();
                resolve(ret);
            } else {
                throw new Error('No main function found in ffmpegCore');
            }
        } catch (e) {
            // Always try to free memory on error
            freeAllocatedMemory();

            // Emscripten may throw on exit - check if it's a normal exit
            if (e.name === 'ExitStatus' || (e.message && e.message.includes('exit'))) {
                console.log('[Offscreen] FFmpeg exited with status:', e.status || 0);
                resolve(e.status || 0);
            } else {
                console.error('[Offscreen] FFmpeg error:', e);
                reject(e);
            }
        }
    });
}

// Concatenate videos using filter_complex
async function concatenateVideos(files) {
    if (!await initFFmpeg()) {
        return;
    }

    // Helper to clean up all input/output files
    function cleanupFiles(fileCount) {
        for (let i = 0; i < fileCount; i++) {
            try { ffmpegCore.FS.unlink(`input${i}.mp4`); } catch (e) {}
        }
        try { ffmpegCore.FS.unlink('output.mp4'); } catch (e) {}
    }

    try {
        sendProgress('processing', 0, 'Writing input files...');
        duration = 0;

        // Write all input files to virtual filesystem
        for (let i = 0; i < files.length; i++) {
            const filename = `input${i}.mp4`;
            const data = new Uint8Array(files[i].data);
            ffmpegCore.FS.writeFile(filename, data);
            console.log(`[Offscreen] Written ${filename} (${data.length} bytes)`);
        }

        sendProgress('processing', 10, 'Merging videos...');

        // Build ffmpeg command with filter_complex
        const args = ['ffmpeg', '-nostdin', '-y'];
        for (let i = 0; i < files.length; i++) {
            args.push('-i', `input${i}.mp4`);
        }

        // Build filter_complex string
        let filterPads = '';
        for (let i = 0; i < files.length; i++) {
            filterPads += `[${i}:v][${i}:a]`;
        }
        const filterComplex = `${filterPads}concat=n=${files.length}:v=1:a=1[outv][outa]`;

        args.push(
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            'output.mp4'
        );

        console.log('[Offscreen] Running ffmpeg with args:', args);
        await runFFmpeg(args);

        sendProgress('processing', 90, 'Reading output...');

        // Check if output file exists
        try {
            const stat = ffmpegCore.FS.stat('output.mp4');
            console.log('[Offscreen] Output file size:', stat.size);
        } catch (e) {
            console.error('[Offscreen] Output file not found:', e);
            throw new Error('FFmpeg did not produce output file');
        }

        // Read output file
        const outputData = ffmpegCore.FS.readFile('output.mp4');
        console.log('[Offscreen] Read output data, length:', outputData.length);
        const outputBlob = new Blob([outputData], { type: 'video/mp4' });

        // Clean up virtual filesystem
        cleanupFiles(files.length);

        sendProgress('complete', 100, 'Complete!');
        sendComplete(outputBlob);

        console.log(`[Offscreen] Concatenation complete, output size: ${outputBlob.size} bytes`);

    } catch (error) {
        console.error('[Offscreen] Concatenation failed:', error);
        // Always clean up on error
        cleanupFiles(files.length);
        sendError(`Concatenation failed: ${error.message}`);
    }
}

// Concatenate videos without audio
async function concatenateVideosNoAudio(files) {
    if (!await initFFmpeg()) {
        return;
    }

    // Helper to clean up all input/output files
    function cleanupFiles(fileCount) {
        for (let i = 0; i < fileCount; i++) {
            try { ffmpegCore.FS.unlink(`input${i}.mp4`); } catch (e) {}
        }
        try { ffmpegCore.FS.unlink('output.mp4'); } catch (e) {}
    }

    try {
        sendProgress('processing', 0, 'Writing input files...');
        duration = 0;

        for (let i = 0; i < files.length; i++) {
            const filename = `input${i}.mp4`;
            const data = new Uint8Array(files[i].data);
            ffmpegCore.FS.writeFile(filename, data);
        }

        sendProgress('processing', 10, 'Merging videos (no audio)...');

        const args = ['ffmpeg', '-nostdin', '-y'];
        for (let i = 0; i < files.length; i++) {
            args.push('-i', `input${i}.mp4`);
        }

        let filterPads = '';
        for (let i = 0; i < files.length; i++) {
            filterPads += `[${i}:v]`;
        }
        const filterComplex = `${filterPads}concat=n=${files.length}:v=1:a=0[outv]`;

        args.push(
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            'output.mp4'
        );

        await runFFmpeg(args);

        sendProgress('processing', 90, 'Reading output...');

        // Check if output file exists
        try {
            const stat = ffmpegCore.FS.stat('output.mp4');
            console.log('[Offscreen] Output file size:', stat.size);
        } catch (e) {
            console.error('[Offscreen] Output file not found:', e);
            throw new Error('FFmpeg did not produce output file');
        }

        const outputData = ffmpegCore.FS.readFile('output.mp4');
        console.log('[Offscreen] Read output data, length:', outputData.length);
        const outputBlob = new Blob([outputData], { type: 'video/mp4' });

        // Clean up virtual filesystem
        cleanupFiles(files.length);

        sendProgress('complete', 100, 'Complete!');
        sendComplete(outputBlob);

    } catch (error) {
        console.error('[Offscreen] Concatenation (no audio) failed:', error);
        // Always clean up on error
        cleanupFiles(files.length);
        sendError(`Concatenation failed: ${error.message}`);
    }
}

// Concatenate videos reading from IndexedDB (avoids 64MB message limit)
async function concatenateVideosFromDB(videoInfos, targetWidth, targetHeight, includeAudio = true) {
    if (!await initFFmpeg()) {
        return;
    }

    // Helper to clean up all input/output files
    function cleanupFiles(fileCount) {
        for (let i = 0; i < fileCount; i++) {
            try { ffmpegCore.FS.unlink(`input${i}.mp4`); } catch (e) {}
        }
        try { ffmpegCore.FS.unlink('output.mp4'); } catch (e) {}
    }

    try {
        sendProgress('loading', 0, 'Starting video merge...');
        duration = 0;

        const totalVideos = videoInfos.length;
        console.log(`[Offscreen] Starting to load ${totalVideos} videos from IndexedDB`);

        // Load and optionally normalize each video
        for (let i = 0; i < totalVideos; i++) {
            const info = videoInfos[i];

            // Progress: 0-40% for loading videos
            const loadProgress = Math.round((i / totalVideos) * 40);
            sendProgress('loading', loadProgress, `Loading video ${i + 1}/${totalVideos}...`);
            console.log(`[Offscreen] Loading video ${i + 1}/${totalVideos}: ${info.videoId}`);

            // Read video from IndexedDB
            const video = await getVideo(info.videoId);
            if (!video) {
                throw new Error(`Video not found: ${info.videoId}`);
            }

            // Convert blob to Uint8Array
            const arrayBuffer = await video.blob.arrayBuffer();
            let videoData = new Uint8Array(arrayBuffer);
            console.log(`[Offscreen] Loaded video ${i + 1}, size: ${videoData.length} bytes`);

            // Normalize if needed (resolution mismatch)
            if (info.needsNormalization && targetWidth && targetHeight) {
                // Progress: show normalizing status
                sendProgress('loading', loadProgress, `Normalizing video ${i + 1}/${totalVideos}...`);
                console.log(`[Offscreen] Normalizing video ${i + 1} to ${targetWidth}x${targetHeight}`);

                const meta = info.metadata || {};
                const normalizedData = await normalizeVideo(
                    Array.from(videoData),
                    targetWidth,
                    targetHeight,
                    meta.duration || 5,
                    meta.hasAudio ?? true
                );

                if (normalizedData) {
                    videoData = new Uint8Array(normalizedData);
                    console.log(`[Offscreen] Video ${i + 1} normalized successfully, new size: ${videoData.length} bytes`);
                } else {
                    console.warn(`[Offscreen] Failed to normalize video ${i + 1}, using original`);
                }
            }

            // Write to virtual filesystem
            const filename = `input${i}.mp4`;
            ffmpegCore.FS.writeFile(filename, videoData);

            // Update progress after writing
            const writeProgress = Math.round(((i + 1) / totalVideos) * 40);
            sendProgress('loading', writeProgress, `Prepared video ${i + 1}/${totalVideos}`);
            console.log(`[Offscreen] Written ${filename} (${videoData.length} bytes)`);

            // Small delay to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        sendProgress('processing', 45, `All ${totalVideos} videos loaded. Starting merge...`);
        console.log(`[Offscreen] All ${totalVideos} videos loaded, starting FFmpeg merge`);

        // Warn user that merge takes time
        await new Promise(resolve => setTimeout(resolve, 100)); // Let UI update
        sendProgress('processing', 48, `Merging ${totalVideos} videos. This may take a while, please wait...`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Let UI update

        // Build ffmpeg command with filter_complex
        const args = ['ffmpeg', '-nostdin', '-y'];
        for (let i = 0; i < totalVideos; i++) {
            args.push('-i', `input${i}.mp4`);
        }

        // Build filter_complex string
        let filterPads = '';
        if (includeAudio) {
            for (let i = 0; i < totalVideos; i++) {
                filterPads += `[${i}:v][${i}:a]`;
            }
            const filterComplex = `${filterPads}concat=n=${totalVideos}:v=1:a=1[outv][outa]`;
            args.push(
                '-filter_complex', filterComplex,
                '-map', '[outv]',
                '-map', '[outa]',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                'output.mp4'
            );
        } else {
            for (let i = 0; i < totalVideos; i++) {
                filterPads += `[${i}:v]`;
            }
            const filterComplex = `${filterPads}concat=n=${totalVideos}:v=1:a=0[outv]`;
            args.push(
                '-filter_complex', filterComplex,
                '-map', '[outv]',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '23',
                'output.mp4'
            );
        }

        console.log('[Offscreen] Running ffmpeg with args:', args);
        sendProgress('processing', 50, `Encoding ${totalVideos} videos... (this step takes the longest, please wait)`);
        await new Promise(resolve => setTimeout(resolve, 50)); // Ensure UI updates before blocking
        await runFFmpeg(args);

        sendProgress('processing', 85, 'Encoding complete. Reading output...');
        console.log('[Offscreen] FFmpeg finished, reading output');

        // Check if output file exists
        try {
            const stat = ffmpegCore.FS.stat('output.mp4');
            console.log('[Offscreen] Output file size:', stat.size);
            sendProgress('processing', 90, `Output ready: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
        } catch (e) {
            console.error('[Offscreen] Output file not found:', e);
            throw new Error('FFmpeg did not produce output file');
        }

        // Read output file
        const outputData = ffmpegCore.FS.readFile('output.mp4');
        console.log('[Offscreen] Read output data, length:', outputData.length);
        const outputBlob = new Blob([outputData], { type: 'video/mp4' });

        sendProgress('processing', 95, 'Saving to storage...');

        // Clean up virtual filesystem
        cleanupFiles(totalVideos);

        await sendComplete(outputBlob);
        sendProgress('complete', 100, 'Export complete!');

        console.log(`[Offscreen] Concatenation from DB complete, output size: ${outputBlob.size} bytes`);

    } catch (error) {
        console.error('[Offscreen] Concatenation from DB failed:', error);
        cleanupFiles(videoInfos.length);
        sendError(`Concatenation failed: ${error.message}`);
    }
}

// Extract a frame from video (fast seek for <1s extraction)
async function extractFrame(videoData, position = 'last') {
    if (!await initFFmpeg()) {
        return null;
    }

    try {
        console.log(`[Offscreen] Extracting ${position} frame...`);

        // Write input video
        const data = new Uint8Array(videoData);
        ffmpegCore.FS.writeFile('input.mp4', data);

        // First, get video duration if extracting last frame
        let seekTime = 0;
        if (position === 'last') {
            // Run ffprobe-like command to get duration
            resetVideoInfo();
            const probeArgs = ['ffmpeg', '-nostdin', '-i', 'input.mp4', '-f', 'null', '-'];

            // Temporarily capture output for duration
            try {
                await runFFmpeg(probeArgs);
            } catch (e) {
                // Expected to fail, but we capture the info
                console.log('[Offscreen] Probe error (expected):', e.message || e);
            }

            console.log('[Offscreen] After probe, videoInfo:', JSON.stringify(videoInfo));

            if (videoInfo && videoInfo.duration > 0) {
                // Seek to 0.1s before the end to get last frame
                seekTime = Math.max(0, videoInfo.duration - 0.1);
                console.log(`[Offscreen] Duration: ${videoInfo.duration}s, seeking to ${seekTime}s`);
            } else {
                // Fallback: try to get duration using HTML5 video element approach
                console.warn('[Offscreen] Could not get duration from FFmpeg, using fallback...');
                // Try seeking to end of file by using a very large number (FFmpeg will clamp it)
                seekTime = 9999;
            }
        }

        console.log(`[Offscreen] Seeking to ${seekTime}s for ${position} frame`);

        // Extract frame
        let args;
        let frameExtracted = false;

        if (position === 'last') {
            // Method 1: Try -sseof (seek from end of file) - most reliable if supported
            try {
                args = [
                    'ffmpeg', '-nostdin', '-y',
                    '-sseof', '-0.1',  // 0.1 seconds before end
                    '-i', 'input.mp4',
                    '-vframes', '1',
                    '-f', 'image2',
                    'frame.png'
                ];
                console.log('[Offscreen] Trying -sseof method:', args.join(' '));
                await runFFmpeg(args);

                // Check if frame was created
                try {
                    ffmpegCore.FS.stat('frame.png');
                    frameExtracted = true;
                    console.log('[Offscreen] -sseof method succeeded');
                } catch (e) {
                    console.log('[Offscreen] -sseof method did not create frame');
                }
            } catch (e) {
                console.log('[Offscreen] -sseof method failed:', e.message || e);
            }

            // Method 2: If -sseof failed, use -update to keep last frame
            if (!frameExtracted) {
                console.log('[Offscreen] Trying -update method (processes all frames)...');
                try {
                    // Cleanup any partial output
                    try { ffmpegCore.FS.unlink('frame.png'); } catch (e) {}

                    args = [
                        'ffmpeg', '-nostdin', '-y',
                        '-i', 'input.mp4',
                        '-vf', 'select=1',  // Select all frames
                        '-update', '1',      // Keep overwriting with latest frame
                        '-q:v', '2',
                        'frame.png'
                    ];
                    console.log('[Offscreen] FFmpeg args:', args.join(' '));
                    await runFFmpeg(args);
                    frameExtracted = true;
                } catch (e) {
                    console.log('[Offscreen] -update method failed:', e.message || e);
                }
            }

            // Method 3: If duration was found, use -ss with duration
            if (!frameExtracted && seekTime > 0) {
                console.log('[Offscreen] Trying -ss with calculated time...');
                try {
                    try { ffmpegCore.FS.unlink('frame.png'); } catch (e) {}

                    args = [
                        'ffmpeg', '-nostdin', '-y',
                        '-ss', seekTime.toString(),
                        '-i', 'input.mp4',
                        '-vframes', '1',
                        '-f', 'image2',
                        'frame.png'
                    ];
                    console.log('[Offscreen] FFmpeg args:', args.join(' '));
                    await runFFmpeg(args);
                    frameExtracted = true;
                } catch (e) {
                    console.log('[Offscreen] -ss method failed:', e.message || e);
                }
            }
        } else {
            // First frame - seek to beginning
            args = [
                'ffmpeg', '-nostdin', '-y',
                '-ss', '0',
                '-i', 'input.mp4',
                '-vframes', '1',
                '-f', 'image2',
                'frame.png'
            ];
            console.log('[Offscreen] FFmpeg args:', args.join(' '));
            await runFFmpeg(args);
        }

        // Check if frame was created
        let frameData;
        try {
            frameData = ffmpegCore.FS.readFile('frame.png');
            console.log(`[Offscreen] Frame extracted, size: ${frameData.length} bytes`);
        } catch (e) {
            console.error('[Offscreen] Frame file not found:', e);
            throw new Error('Failed to extract frame');
        }

        // Convert to base64 data URL
        const blob = new Blob([frameData], { type: 'image/png' });
        const dataUrl = await blobToDataUrl(blob);

        // Cleanup
        try { ffmpegCore.FS.unlink('input.mp4'); } catch (e) {}
        try { ffmpegCore.FS.unlink('frame.png'); } catch (e) {}

        console.log(`[Offscreen] Frame extraction complete`);
        return dataUrl;

    } catch (error) {
        console.error('[Offscreen] Frame extraction failed:', error);
        throw error;
    }
}

// Analyze video to get specs (resolution, fps, duration, hasAudio, colorSpace)
async function analyzeVideo(videoData) {
    if (!await initFFmpeg()) {
        return null;
    }

    try {
        console.log('[Offscreen] Analyzing video...');

        // Write input video
        const data = new Uint8Array(videoData);
        ffmpegCore.FS.writeFile('analyze.mp4', data);

        // Reset video info
        resetVideoInfo();

        // Run FFmpeg to get video info (it will output to stderr which we parse)
        const args = ['ffmpeg', '-nostdin', '-i', 'analyze.mp4', '-f', 'null', '-'];

        try {
            await runFFmpeg(args);
        } catch (e) {
            // Expected to exit with error since we're not producing output
        }

        // Cleanup
        try { ffmpegCore.FS.unlink('analyze.mp4'); } catch (e) {}

        const result = {
            duration: videoInfo?.duration || 0,
            resolution: videoInfo?.resolution || null,
            fps: videoInfo?.fps || 0,
            hasAudio: videoInfo?.hasAudio || false,
            hasVideo: videoInfo?.hasVideo || false,
            colorSpace: videoInfo?.colorSpace || 'unknown',
            codec: videoInfo?.codec || null,
            audioCodec: videoInfo?.audioCodec || null,
            size: data.length
        };

        console.log('[Offscreen] Video analysis complete:', result);
        return result;

    } catch (error) {
        console.error('[Offscreen] Video analysis failed:', error);
        throw error;
    }
}

// Helper: Convert Blob to data URL
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Scale video to match master resolution with padding
async function scaleVideo(videoData, targetWidth, targetHeight) {
    if (!await initFFmpeg()) {
        return null;
    }

    try {
        console.log(`[Offscreen] Scaling video to ${targetWidth}x${targetHeight}...`);

        const data = new Uint8Array(videoData);
        ffmpegCore.FS.writeFile('scale_input.mp4', data);

        // Scale filter: scale to target while maintaining aspect ratio, then pad
        const filter = `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease,` +
                       `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,` +
                       `setsar=1`;

        const args = [
            'ffmpeg', '-nostdin', '-y',
            '-i', 'scale_input.mp4',
            '-vf', filter,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'copy',
            'scale_output.mp4'
        ];

        await runFFmpeg(args);

        let outputData;
        try {
            outputData = ffmpegCore.FS.readFile('scale_output.mp4');
            console.log(`[Offscreen] Scaled video size: ${outputData.length} bytes`);
        } catch (e) {
            console.error('[Offscreen] Scale output not found:', e);
            throw new Error('Failed to scale video');
        }

        // Cleanup
        try { ffmpegCore.FS.unlink('scale_input.mp4'); } catch (e) {}
        try { ffmpegCore.FS.unlink('scale_output.mp4'); } catch (e) {}

        return Array.from(outputData);

    } catch (error) {
        console.error('[Offscreen] Scale video failed:', error);
        throw error;
    }
}

// Add silent audio track to video without audio
async function addSilentAudio(videoData, duration) {
    if (!await initFFmpeg()) {
        return null;
    }

    try {
        console.log(`[Offscreen] Adding silent audio (${duration}s)...`);

        const data = new Uint8Array(videoData);
        ffmpegCore.FS.writeFile('silent_input.mp4', data);

        // Generate silent audio and mux with video
        const args = [
            'ffmpeg', '-nostdin', '-y',
            '-i', 'silent_input.mp4',
            '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
            '-t', duration.toString(),
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-shortest',
            'silent_output.mp4'
        ];

        await runFFmpeg(args);

        let outputData;
        try {
            outputData = ffmpegCore.FS.readFile('silent_output.mp4');
            console.log(`[Offscreen] Output with silent audio size: ${outputData.length} bytes`);
        } catch (e) {
            console.error('[Offscreen] Silent audio output not found:', e);
            throw new Error('Failed to add silent audio');
        }

        // Cleanup
        try { ffmpegCore.FS.unlink('silent_input.mp4'); } catch (e) {}
        try { ffmpegCore.FS.unlink('silent_output.mp4'); } catch (e) {}

        return Array.from(outputData);

    } catch (error) {
        console.error('[Offscreen] Add silent audio failed:', error);
        throw error;
    }
}

// Normalize video: scale to target resolution + add silent audio if needed
async function normalizeVideo(videoData, targetWidth, targetHeight, duration, hasAudio) {
    if (!await initFFmpeg()) {
        return null;
    }

    try {
        console.log(`[Offscreen] Normalizing video to ${targetWidth}x${targetHeight}...`);

        const data = new Uint8Array(videoData);
        ffmpegCore.FS.writeFile('norm_input.mp4', data);

        // Scale filter
        const filter = `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease,` +
                       `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,` +
                       `setsar=1`;

        let args;

        if (hasAudio) {
            // Video has audio, just scale
            args = [
                'ffmpeg', '-nostdin', '-y',
                '-i', 'norm_input.mp4',
                '-vf', filter,
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '128k',
                'norm_output.mp4'
            ];
        } else {
            // Video has no audio, add silent audio
            args = [
                'ffmpeg', '-nostdin', '-y',
                '-i', 'norm_input.mp4',
                '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
                '-t', duration.toString(),
                '-vf', filter,
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-shortest',
                'norm_output.mp4'
            ];
        }

        await runFFmpeg(args);

        let outputData;
        try {
            outputData = ffmpegCore.FS.readFile('norm_output.mp4');
            console.log(`[Offscreen] Normalized video size: ${outputData.length} bytes`);
        } catch (e) {
            console.error('[Offscreen] Normalize output not found:', e);
            throw new Error('Failed to normalize video');
        }

        // Cleanup
        try { ffmpegCore.FS.unlink('norm_input.mp4'); } catch (e) {}
        try { ffmpegCore.FS.unlink('norm_output.mp4'); } catch (e) {}

        return Array.from(outputData);

    } catch (error) {
        console.error('[Offscreen] Normalize video failed:', error);
        throw error;
    }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Offscreen] Received message:', message.action);

    if (message.action === 'concat') {
        // Check includeAudio option (default true for backwards compatibility)
        const includeAudio = message.includeAudio !== false;
        console.log('[Offscreen] Concat with includeAudio:', includeAudio);
        if (includeAudio) {
            concatenateVideos(message.files);
        } else {
            concatenateVideosNoAudio(message.files);
        }
        sendResponse({ received: true });
    } else if (message.action === 'concatNoAudio') {
        // Keep for backwards compatibility
        concatenateVideosNoAudio(message.files);
        sendResponse({ received: true });
    } else if (message.action === 'extractFrame') {
        // Extract frame from video
        (async () => {
            try {
                const dataUrl = await extractFrame(message.videoData, message.position || 'last');
                sendResponse({ success: true, dataUrl });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep channel open for async response
    } else if (message.action === 'analyzeVideo') {
        // Analyze video specs
        (async () => {
            try {
                const info = await analyzeVideo(message.videoData);
                sendResponse({ success: true, info });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep channel open for async response
    } else if (message.action === 'scaleVideo') {
        // Scale video to target resolution
        (async () => {
            try {
                const result = await scaleVideo(
                    message.videoData,
                    message.targetWidth,
                    message.targetHeight
                );
                sendResponse({ success: true, data: result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    } else if (message.action === 'addSilentAudio') {
        // Add silent audio to video
        (async () => {
            try {
                const result = await addSilentAudio(message.videoData, message.duration);
                sendResponse({ success: true, data: result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    } else if (message.action === 'normalizeVideo') {
        // Normalize video (scale + add silent audio if needed)
        (async () => {
            try {
                const result = await normalizeVideo(
                    message.videoData,
                    message.targetWidth,
                    message.targetHeight,
                    message.duration,
                    message.hasAudio
                );
                sendResponse({ success: true, data: result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    } else if (message.action === 'concatFromDB') {
        // Concatenate videos reading directly from IndexedDB (avoids 64MB message limit)
        (async () => {
            try {
                await concatenateVideosFromDB(
                    message.videoInfos,
                    message.targetWidth,
                    message.targetHeight,
                    message.includeAudio
                );
                sendResponse({ received: true });
            } catch (error) {
                console.error('[Offscreen] concatFromDB failed:', error);
                sendError(`Concatenation failed: ${error.message}`);
                sendResponse({ received: true });
            }
        })();
        return true;
    } else if (message.action === 'ping') {
        sendResponse({ alive: true, loaded: isLoaded });
        return true;
    }

    // 不處理其他消息，不返回 true
    return false;
});

console.log('[Offscreen] Offscreen document ready');
