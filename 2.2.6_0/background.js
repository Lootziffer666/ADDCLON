// Background script for handling downloads and license validation
// Grok Video Studio v2.0

// Import IndexedDB module for video storage
importScripts('lib/db.js');

// Import Queue DB module (separate database)
importScripts('lib/queue-db.js');

// Import shared utilities
importScripts('src/utils.js');

// Import logger for queue logging
importScripts('src/logger.js');

// Map to store intended filenames for URLs
const pendingDownloads = new Map();

// Offscreen document state
let creatingOffscreen = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download') {
        // Store the intended filename and options
        pendingDownloads.set(request.url, {
            filename: request.filename,
            overwrite: request.overwrite === true
        });

        // 處理下載請求
        handleDownload(request.url, request.filename).then(downloadId => {
            sendResponse({ success: true, downloadId });
        }).catch(error => {
            pendingDownloads.delete(request.url); // Clean up on error
            sendResponse({ success: false, error: error.message });
        });
        return true; // 保持消息通道開啟以進行異步響應
    }

    if (request.action === 'activateLicense') {
        validateLicense(request.licenseKey).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    // Video merge request from side panel (legacy - with data)
    if (request.action === 'mergeVideos') {
        handleMergeVideos(request.files, request.includeAudio);
        sendResponse({ received: true });
        return true;
    }

    // Video merge request from side panel (new - with video IDs only, avoids 64MB limit)
    if (request.action === 'mergeVideosFromDB') {
        handleMergeVideosFromDB(request.videoInfos, request.targetWidth, request.targetHeight, request.includeAudio);
        sendResponse({ received: true });
        return true;
    }

    // Normalize video (scale to target resolution)
    if (request.action === 'normalizeVideo') {
        (async () => {
            try {
                await ensureOffscreenDocument();
                await new Promise(resolve => setTimeout(resolve, 100));

                const result = await chrome.runtime.sendMessage({
                    action: 'normalizeVideo',
                    videoData: request.videoData,
                    targetWidth: request.targetWidth,
                    targetHeight: request.targetHeight,
                    duration: request.duration,
                    hasAudio: request.hasAudio
                });

                sendResponse(result);
            } catch (error) {
                console.error('[Background] Video normalization failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Download merged result
    if (request.action === 'downloadResult') {
        handleDownload(request.dataUrl, request.filename).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    // FFmpeg progress/complete/error from offscreen - forward to side panel
    if (request.action === 'ffmpegProgress' ||
        request.action === 'ffmpegComplete' ||
        request.action === 'ffmpegError') {
        // Forward to all extension pages (side panel will receive it)
        forwardToSidePanel(request);
        sendResponse({ received: true });
        return true;
    }

    // Open side panel request
    if (request.action === 'openSidePanel') {
        chrome.sidePanel.open({ windowId: request.windowId }).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    // ==========================================
    // Video Studio - IndexedDB Operations
    // ==========================================

    // Store video blob in IndexedDB
    if (request.action === 'storeVideoBlob') {
        (async () => {
            try {
                const videoData = new Uint8Array(request.videoData);
                const blob = new Blob([videoData], { type: 'video/mp4' });
                const videoId = await GrokDB.saveVideo(blob, request.metadata || {});
                sendResponse({ success: true, videoId });
            } catch (error) {
                console.error('[Background] Failed to store video:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Capture video from URL directly in background (avoids 64MB message limit)
    if (request.action === 'captureVideoFromUrl') {
        (async () => {
            try {
                const response = await fetch(request.videoUrl, { credentials: 'include' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const metadata = { ...(request.metadata || {}), size: blob.size };
                const videoId = await GrokDB.saveVideo(blob, metadata);
                const sizeMB = (blob.size / 1024 / 1024).toFixed(2) + ' MB';
                sendResponse({ success: true, videoId, size: sizeMB });
            } catch (error) {
                console.error('[Background] Failed to capture video from URL:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Download video directly from IndexedDB (avoids 64MB message limit)
    if (request.action === 'downloadVideoFromDB') {
        (async () => {
            try {
                const video = await GrokDB.getVideo(request.videoId);
                if (video) {
                    // Convert blob to base64 dataUrl for download API
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        try {
                            await handleDownload(reader.result, request.filename);
                            sendResponse({ success: true });
                        } catch (downloadError) {
                            sendResponse({ success: false, error: downloadError.message });
                        }
                    };
                    reader.onerror = () => {
                        sendResponse({ success: false, error: 'Failed to read video blob' });
                    };
                    reader.readAsDataURL(video.blob);
                } else {
                    sendResponse({ success: false, error: 'Video not found' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Get video from IndexedDB
    if (request.action === 'getVideoFromDB') {
        (async () => {
            try {
                const video = await GrokDB.getVideo(request.videoId);
                if (video) {
                    // Convert blob to array for transfer
                    const arrayBuffer = await video.blob.arrayBuffer();
                    sendResponse({
                        success: true,
                        video: {
                            id: video.id,
                            data: Array.from(new Uint8Array(arrayBuffer)),
                            metadata: video.metadata,
                            timestamp: video.timestamp
                        }
                    });
                } else {
                    sendResponse({ success: false, error: 'Video not found' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Get all videos from IndexedDB (metadata only, no blob data)
    if (request.action === 'getAllVideosFromDB') {
        (async () => {
            try {
                const videos = await GrokDB.getAllVideos();
                sendResponse({
                    success: true,
                    videos: videos.map(v => ({
                        id: v.id,
                        metadata: v.metadata,
                        timestamp: v.timestamp
                    }))
                });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Delete video from IndexedDB
    if (request.action === 'deleteVideoFromDB') {
        (async () => {
            try {
                await GrokDB.deleteVideo(request.videoId);
                // Also delete associated frames
                const frames = await GrokDB.getFramesByVideoId(request.videoId);
                for (const frame of frames) {
                    await GrokDB.deleteFrame(frame.id);
                }
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Extract frame from video using FFmpeg
    if (request.action === 'extractFrameFromVideo') {
        (async () => {
            try {
                // Get video from IndexedDB
                const video = await GrokDB.getVideo(request.videoId);
                if (!video) {
                    sendResponse({ success: false, error: 'Video not found' });
                    return;
                }

                // Ensure offscreen document is ready
                await ensureOffscreenDocument();
                await new Promise(resolve => setTimeout(resolve, 100));

                // Convert blob to array for transfer
                const arrayBuffer = await video.blob.arrayBuffer();

                // Send to offscreen for frame extraction
                const result = await chrome.runtime.sendMessage({
                    action: 'extractFrame',
                    videoData: Array.from(new Uint8Array(arrayBuffer)),
                    position: request.position || 'last'
                });

                if (result.success) {
                    // Store frame in IndexedDB
                    const frameId = await GrokDB.saveFrame(
                        request.videoId,
                        result.dataUrl,
                        request.position || 'last'
                    );
                    sendResponse({ success: true, frameId, dataUrl: result.dataUrl });
                } else {
                    sendResponse({ success: false, error: result.error });
                }
            } catch (error) {
                console.error('[Background] Frame extraction failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Analyze video specs using FFmpeg
    if (request.action === 'analyzeVideoFromDB') {
        (async () => {
            try {
                const video = await GrokDB.getVideo(request.videoId);
                if (!video) {
                    sendResponse({ success: false, error: 'Video not found' });
                    return;
                }

                await ensureOffscreenDocument();
                await new Promise(resolve => setTimeout(resolve, 100));

                const arrayBuffer = await video.blob.arrayBuffer();

                const result = await chrome.runtime.sendMessage({
                    action: 'analyzeVideo',
                    videoData: Array.from(new Uint8Array(arrayBuffer))
                });

                if (result.success) {
                    // Update video metadata in IndexedDB
                    await GrokDB.updateVideoMetadata(request.videoId, result.info);
                    sendResponse({ success: true, info: result.info });
                } else {
                    sendResponse({ success: false, error: result.error });
                }
            } catch (error) {
                console.error('[Background] Video analysis failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Get frame from IndexedDB
    if (request.action === 'getFrameFromDB') {
        (async () => {
            try {
                const frame = await GrokDB.getVideoFrame(request.videoId, request.position || 'last');
                if (frame) {
                    sendResponse({ success: true, frame });
                } else {
                    sendResponse({ success: false, error: 'Frame not found' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Save/update sequence
    if (request.action === 'saveSequence') {
        (async () => {
            try {
                await GrokDB.saveSequence(request.sequence);
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Get sequence
    if (request.action === 'getSequence') {
        (async () => {
            try {
                const sequence = await GrokDB.getSequence();
                sendResponse({ success: true, sequence });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Clear sequence
    if (request.action === 'clearSequence') {
        (async () => {
            try {
                await GrokDB.clearSequence();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Clear all IndexedDB data (videos, frames, sequence)
    if (request.action === 'clearAllDB') {
        (async () => {
            try {
                await GrokDB.clearAllData();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Get storage usage
    if (request.action === 'getStorageUsage') {
        (async () => {
            try {
                const usage = await GrokDB.getStorageUsage();
                sendResponse({ success: true, usage });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Forward new video detected to sidepanel
    if (request.action === 'newVideoDetected') {
        forwardToSidePanel(request);
        sendResponse({ received: true });
        return true;
    }

    // Fetch video from URL and store in IndexedDB (for drag-drop from Grok Favorites)
    if (request.action === 'fetchAndStoreVideo') {
        (async () => {
            try {
                console.log('[Background] Fetching video from URL:', request.url?.substring(0, 100) + '...');

                const response = await fetch(request.url, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'video/*,*/*'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const blob = await response.blob();
                const sizeMB = blob.size / 1024 / 1024;
                console.log(`[Background] Content fetched: ${sizeMB.toFixed(2)} MB, type: ${blob.type}`);

                // Validate that we got a video, not an image
                const contentType = blob.type || response.headers.get('content-type') || '';
                if (contentType.startsWith('image/')) {
                    throw new Error('This URL points to an image, not a video. Please drag the actual video element or copy the video URL.');
                }

                // Check file size - videos should be at least 100KB
                if (blob.size < 100 * 1024) {
                    // Try to detect if it's actually an image by checking magic bytes（使用 GrokUtils）
                    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
                    const imageDetection = GrokUtils.detectImageFromHeader(header);

                    if (imageDetection.isImage) {
                        throw new Error('This URL points to an image thumbnail, not a video. Try right-clicking the video and selecting "Copy video address".');
                    }

                    console.warn('[Background] File is very small, may not be a valid video');
                }

                // Determine filename from URL or use default（使用 GrokUtils）
                const filename = GrokUtils.extractFilenameFromUrl(request.url, 'grok_video.mp4');

                // Store in IndexedDB
                const videoId = await GrokDB.saveVideo(blob, {
                    name: request.filename || filename,
                    sourceUrl: request.url,
                    size: blob.size,
                    isMaster: request.isMaster || false,
                    capturedAt: Date.now()
                });

                console.log(`[Background] Video stored with ID: ${videoId}`);
                sendResponse({ success: true, videoId, size: blob.size });

            } catch (error) {
                console.error('[Background] fetchAndStoreVideo failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Video Gen Queue - CRUD Operations
    // ==========================================

    if (request.action === 'addQueueItem') {
        (async () => {
            try {
                const item = await GrokQueueDB.addQueueItem(request.item);
                SystemLogger.info('Queue item added', `PostId: ${item.postId}, Target: ${item.targetSuccess}, MaxRetries: ${item.maxRetries}`);
                sendResponse({ success: true, item });
                // Notify side panel to refresh queue list
                chrome.runtime.sendMessage({ action: 'queueProgressUpdate' }).catch(() => {});
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'getQueueItem') {
        (async () => {
            try {
                const item = await GrokQueueDB.getQueueItem(request.id);
                sendResponse({ success: true, item });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'updateQueueItem') {
        (async () => {
            try {
                const item = await GrokQueueDB.updateQueueItem(request.id, request.updates);
                sendResponse({ success: true, item });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'getNextPendingItem') {
        (async () => {
            try {
                const item = await GrokQueueDB.getNextPendingItem();
                sendResponse({ success: true, item });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'getActiveQueueItem') {
        (async () => {
            try {
                const item = await GrokQueueDB.getActiveQueueItem();
                sendResponse({ success: true, item });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'getAllQueueItems') {
        (async () => {
            try {
                const items = await GrokQueueDB.getAllQueueItems();
                sendResponse({ success: true, items });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'deleteQueueItem') {
        (async () => {
            try {
                await GrokQueueDB.deleteQueueItem(request.id);
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'deletePendingItems') {
        (async () => {
            try {
                const count = await GrokQueueDB.deletePendingItems();
                sendResponse({ success: true, count });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'deleteCompletedItems') {
        (async () => {
            try {
                const count = await GrokQueueDB.deleteCompletedItems();
                sendResponse({ success: true, count });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'clearQueue') {
        (async () => {
            try {
                await GrokQueueDB.clearQueue();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Video Gen Queue - Prompt Stats
    // ==========================================

    if (request.action === 'upsertPromptStats') {
        (async () => {
            try {
                const stats = await GrokQueueDB.upsertPromptStats(request.prompt, request.moderated);
                sendResponse({ success: true, stats });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'getAllPromptStats') {
        (async () => {
            try {
                const stats = await GrokQueueDB.getAllPromptStats();
                sendResponse({ success: true, stats });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'updatePromptRating') {
        (async () => {
            try {
                const stats = await GrokQueueDB.updatePromptRating(request.prompt, request.rating);
                sendResponse({ success: true, stats });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'clearPromptStats') {
        (async () => {
            try {
                await GrokQueueDB.clearPromptStats();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Video Gen Queue - Result Handler
    // ==========================================

    if (request.action === 'videoGenResult') {
        (async () => {
            try {
                // Find active queue item — since only one item processes at a time,
                // any video gen result during active processing is for the current item.
                // Note: parentPostId from Grok's API may differ from the image postId
                // (it can be the conversation post ID), so we don't strictly match.
                const activeItem = await GrokQueueDB.getActiveQueueItem();

                if (!activeItem) {
                    // No active queue item — ignore (might be manual generation)
                    SystemLogger.info('Queue videoGenResult ignored', `No active item, parentPostId: ${request.parentPostId}`);
                    sendResponse({ success: true, queued: false });
                    return;
                }
                SystemLogger.info('Queue videoGenResult matched', `activeItem: ${activeItem.postId}, parentPostId: ${request.parentPostId}`);

                // Update queue item counts
                const updates = {
                    totalAttempts: activeItem.totalAttempts + 1
                };

                if (request.moderated) {
                    updates.currentFailure = activeItem.currentFailure + 1;
                    SystemLogger.fail('Queue video moderated', `PostId: ${activeItem.postId}, Failure: ${updates.currentFailure}/${activeItem.maxRetries}`);
                } else {
                    updates.currentSuccess = activeItem.currentSuccess + 1;
                    SystemLogger.ok('Queue video generated', `PostId: ${activeItem.postId}, Success: ${updates.currentSuccess}/${activeItem.targetSuccess}`);

                    // Increment queue video gen usage count
                    const { queueVideoGenCount = 0 } = await chrome.storage.sync.get('queueVideoGenCount');
                    await chrome.storage.sync.set({ queueVideoGenCount: queueVideoGenCount + 1 });
                }

                // Update prompt stats
                await GrokQueueDB.upsertPromptStats(activeItem.prompt, request.moderated);

                // Determine next action
                let shouldRetry = false;
                let shouldMoveNext = false;
                const newSuccess = updates.currentSuccess !== undefined ? updates.currentSuccess : activeItem.currentSuccess;
                const newFailure = updates.currentFailure !== undefined ? updates.currentFailure : activeItem.currentFailure;

                if (newSuccess >= activeItem.targetSuccess) {
                    // Target reached
                    updates.status = 'completed';
                    shouldMoveNext = true;
                    SystemLogger.ok('Queue item completed', `PostId: ${activeItem.postId}, Success: ${newSuccess}`);
                } else if (newFailure >= activeItem.maxRetries) {
                    // Max retries reached
                    updates.status = 'failed';
                    shouldMoveNext = true;
                    SystemLogger.fail('Queue item failed', `PostId: ${activeItem.postId}, Max retries reached`);
                } else {
                    // Continue — either retry after moderation or generate another
                    shouldRetry = true;
                }

                const updatedItem = await GrokQueueDB.updateQueueItem(activeItem.id, updates);

                // Get next item if moving on (check usage limit for non-Pro)
                let nextItem = null;
                let usageLimitReached = false;
                if (shouldMoveNext) {
                    const { queueVideoGenCount: currentCount = 0, isPro: isProUser = false } = await chrome.storage.sync.get(['queueVideoGenCount', 'isPro']);
                    if (!isProUser && currentCount >= 50) {
                        usageLimitReached = true;
                        SystemLogger.fail('Queue usage limit reached', `Count: ${currentCount}/50`);
                    } else {
                        nextItem = await GrokQueueDB.getNextPendingItem();
                    }
                }

                // Relay result to content.js tab
                SystemLogger.info('Queue relay to content', `shouldRetry: ${shouldRetry}, shouldMoveNext: ${shouldMoveNext}, usageLimitReached: ${usageLimitReached}, tabId: ${sender.tab?.id || 'none'}`);
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        action: 'queueItemResult',
                        queueItem: updatedItem,
                        moderated: request.moderated,
                        shouldRetry,
                        shouldMoveNext,
                        nextItem,
                        usageLimitReached
                    }).catch((err) => {
                        SystemLogger.fail('Queue relay failed', `Error: ${err.message}`);
                    });
                } else {
                    SystemLogger.fail('Queue relay failed', 'No sender.tab.id available');
                }

                // Forward update to sidepanel for real-time UI refresh
                forwardToSidePanel({
                    action: 'queueProgressUpdate',
                    queueItem: updatedItem,
                    moderated: request.moderated,
                    shouldMoveNext,
                    nextItem,
                    usageLimitReached
                });

                sendResponse({ success: true, queued: true });
            } catch (error) {
                console.error('[Background] videoGenResult handler error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Video Gen Queue - Error Handler
    // ==========================================

    if (request.action === 'queueItemError') {
        (async () => {
            try {
                const activeItem = await GrokQueueDB.getActiveQueueItem();
                if (activeItem) {
                    await GrokQueueDB.updateQueueItem(activeItem.id, {
                        status: 'error',
                        errorMessage: request.error
                    });
                    SystemLogger.fail('Queue item error', `PostId: ${activeItem.postId}, Error: ${request.error}`);
                }

                // Notify sidepanel about error
                forwardToSidePanel({
                    action: 'queueItemError',
                    error: request.error,
                    queueItem: activeItem
                });

                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'queueRetryErrorItem') {
        (async () => {
            try {
                // Reset to pending — item will be picked up by normal queue processing order
                await GrokQueueDB.updateQueueItem(request.id, { status: 'pending', errorMessage: null });

                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.action === 'queueSkipErrorItem') {
        (async () => {
            try {
                await GrokQueueDB.updateQueueItem(request.id, { status: 'failed' });
                const nextItem = await GrokQueueDB.getNextPendingItem();

                if (request.tabId) {
                    chrome.tabs.sendMessage(request.tabId, {
                        action: 'queueProcessNext',
                        nextItem
                    }).catch(() => {});
                }

                forwardToSidePanel({
                    action: 'queueProgressUpdate',
                    nextItem
                });

                sendResponse({ success: true, nextItem });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Queue Usage
    // ==========================================

    if (request.action === 'getQueueUsage') {
        (async () => {
            try {
                const { queueVideoGenCount = 0, isPro = false } = await chrome.storage.sync.get(['queueVideoGenCount', 'isPro']);
                sendResponse({ success: true, count: queueVideoGenCount, limit: 50, isPro });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // ==========================================
    // Sidepanel Switching
    // ==========================================

    if (request.action === 'switchSidePanel') {
        (async () => {
            try {
                await chrome.sidePanel.setOptions({ path: request.path });
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 不處理其他消息，不返回 true，避免通道懸空
    return false;
});

// Listen for filename determination to enforce our naming convention
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // Check if we have a pending download for this URL
    if (pendingDownloads.has(item.url)) {
        const options = pendingDownloads.get(item.url);
        pendingDownloads.delete(item.url); // Clean up

        suggest({
            filename: options.filename,
            conflictAction: options.overwrite ? 'overwrite' : 'uniquify'
        });
    } else {
        // If we don't track it, let Chrome decide (or other extensions)
        // But we need to check if the URL might have changed due to redirects?
        // For now, assume direct match.
        // We must call suggest() if we return true (which we don't here, but strictly speaking)
        // If we don't call suggest, Chrome waits. 
        // But since we are not returning true asynchronously, it's fine.
    }
});

async function validateLicense(licenseKey) {
    // 真正的驗證邏輯
    // TODO: 請在此處填入您的 Lemon Squeezy Product ID
    // 您可以在 Lemon Squeezy 後台的 Products 列表中找到 ID (例如: 12345)
    const REQUIRED_PRODUCT_ID = '701501';

    try {
        // 開發者測試 Key
        if (licenseKey === 'DEV-TEST-8888') {
            // 檢查是否為開發模式 (未打包安裝通常沒有 update_url)
            const isDevelopment = !chrome.runtime.getManifest().update_url;

            if (!isDevelopment) {
                return { success: false, error: 'Developer key is not available in production build' };
            }

            await chrome.storage.sync.set({
                licenseKey: licenseKey,
                isPro: true,
                licenseData: {
                    activated: true,
                    meta: {
                        variant_name: 'Developer License'
                    }
                }
            });
            return { success: true, data: { activated: true } };
        }

        const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_name: 'GrokDownloadExtension'
            })
        });

        const data = await response.json();

        if (data.activated) {
            // 驗證 Product ID (確保 Key 屬於正確的產品)
            // 如果您設置了 REQUIRED_PRODUCT_ID，我們會檢查它是否匹配
            if (REQUIRED_PRODUCT_ID && data.meta.product_id !== parseInt(REQUIRED_PRODUCT_ID)) {
                return {
                    success: false,
                    error: '此 License Key 不屬於本產品 (Product ID 不匹配)'
                };
            }

            // 保存授權狀態 (使用 sync 以便跨設備同步)
            await chrome.storage.sync.set({
                licenseKey: licenseKey,
                isPro: true,
                licenseData: data
            });
            return { success: true, data: data };
        } else {
            return { success: false, error: data.error || 'Invalid license key' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 遷移舊的本地授權到同步存儲
async function migrateLicenseToSync() {
    try {
        // 檢查本地是否有授權
        const localData = await chrome.storage.local.get(['isPro', 'licenseKey', 'licenseData']);

        if (localData.isPro && localData.licenseKey) {
            console.log('Found local license, migrating to sync storage...');

            // 檢查同步存儲是否已有數據 (避免覆蓋可能更新的同步數據)
            const syncData = await chrome.storage.sync.get(['isPro']);

            if (!syncData.isPro) {
                await chrome.storage.sync.set({
                    isPro: localData.isPro,
                    licenseKey: localData.licenseKey,
                    licenseData: localData.licenseData
                });
                console.log('License migrated to sync storage successfully.');

                // 可選：遷移後清除本地副本，或者保留作為備份
                // await chrome.storage.local.remove(['isPro', 'licenseKey', 'licenseData']);
            }
        }
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// 在擴充功能啟動或安裝時運行遷移
chrome.runtime.onInstalled.addListener(() => {
    migrateLicenseToSync();
    // Enable side panel for all tabs
    chrome.sidePanel.setOptions({
        enabled: true,
        path: 'sidepanel/sidepanel.html'
    });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
chrome.runtime.onStartup.addListener(() => {
    migrateLicenseToSync();
});

async function handleDownload(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(downloadId);
            }
        });
    });
}

// ==========================================
// Offscreen Document Management
// ==========================================

async function ensureOffscreenDocument() {
    const offscreenUrl = 'offscreen/offscreen.html';

    // Check if already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(offscreenUrl)]
    });

    if (existingContexts.length > 0) {
        return; // Already exists
    }

    // Avoid race condition with multiple creation requests
    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: ['WORKERS'],
        justification: 'Run ffmpeg.wasm for video processing'
    });

    await creatingOffscreen;
    creatingOffscreen = null;
    console.log('[Background] Offscreen document created');
}

async function closeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
        console.log('[Background] Offscreen document closed');
    } catch (error) {
        // Ignore if not open
    }
}

// Handle video merge request (legacy - receives full data)
async function handleMergeVideos(files, includeAudio = true) {
    console.log('[Background] Starting video merge with', files.length, 'files, includeAudio:', includeAudio);

    try {
        // Ensure offscreen document is ready
        await ensureOffscreenDocument();

        // Small delay to ensure offscreen is fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send files to offscreen for processing
        chrome.runtime.sendMessage({
            action: 'concat',
            files: files,
            includeAudio: includeAudio
        });

    } catch (error) {
        console.error('[Background] Failed to start merge:', error);
        forwardToSidePanel({
            action: 'ffmpegError',
            error: `Failed to start processing: ${error.message}`
        });
    }
}

// Handle video merge request from DB (new - avoids 64MB limit)
// Offscreen document reads directly from IndexedDB
async function handleMergeVideosFromDB(videoInfos, targetWidth, targetHeight, includeAudio = true) {
    console.log('[Background] Starting video merge from DB with', videoInfos.length, 'videos');

    try {
        // Ensure offscreen document is ready
        await ensureOffscreenDocument();

        // Small delay to ensure offscreen is fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send only video IDs to offscreen - it will read from IndexedDB directly
        chrome.runtime.sendMessage({
            action: 'concatFromDB',
            videoInfos: videoInfos,
            targetWidth: targetWidth,
            targetHeight: targetHeight,
            includeAudio: includeAudio
        });

    } catch (error) {
        console.error('[Background] Failed to start merge from DB:', error);
        forwardToSidePanel({
            action: 'ffmpegError',
            error: `Failed to start processing: ${error.message}`
        });
    }
}

// Forward message to side panel
function forwardToSidePanel(message) {
    // Send to all extension contexts - side panel will receive it
    chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if no listeners
    });
}

