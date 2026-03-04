import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── TSX Code Extractor (same logic as your App.tsx) ───
function extractTsxBlocks(text) {
    const blocks = [];

    // Pattern 1: Markdown-style code blocks ```tsx ... ```
    const mdRegex = /```(tsx|typescript|jsx|javascript)\n([\s\S]*?)```/g;
    let match;
    while ((match = mdRegex.exec(text)) !== null) {
        blocks.push({
            id: `block-${blocks.length + 1}`,
            type: match[1] === 'typescript' ? 'ts' : match[1],
            code: match[2].trim()
        });
    }

    // Pattern 2: Fallback — if no markdown blocks found, treat entire text as one block
    if (blocks.length === 0) {
        if (text.includes('import') || (text.includes('<') && text.includes('/>'))) {
            blocks.push({
                id: 'auto-1',
                type: 'tsx',
                code: text.trim()
            });
        }
    }

    return blocks;
}

// ─── Main Automation ───
(async () => {
    // 1. Read input text from a file (input.txt)
    const inputFile = path.join(__dirname, 'input.txt');
    if (!fs.existsSync(inputFile)) {
        console.error('❌ automation/input.txt not found!');
        process.exit(1);
    }

    const inputText = fs.readFileSync(inputFile, 'utf-8');
    const blocks = extractTsxBlocks(inputText);

    if (blocks.length === 0) {
        console.error('❌ No TSX code blocks found in input.txt');
        process.exit(1);
    }

    console.log(`✅ Found ${blocks.length} TSX code block(s). Starting automation...\n`);

    // 2. Setup downloads directory
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // 3. Launch browser with flags to auto-grant screen/tab sharing
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--use-fake-ui-for-media-stream',
            '--enable-usermedia-screen-capturing',
            '--auto-select-desktop-capture-source=kuTSX',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ]
    });

    const context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write'],
    });

    // Grant permission for getDisplayMedia automatically
    context.grantPermissions(['camera', 'microphone']);

    const page = await context.newPage();

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const videoName = `video_${i + 1}`;
        console.log(`\n🎬 [${i + 1}/${blocks.length}] Processing: ${videoName}`);

        try {
            // Step 1: Navigate to the site
            await page.goto('https://kux-three.vercel.app/', { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);

            // Step 2: Paste TSX code into the editor
            const editorSelector = 'textarea[placeholder*="Paste Remotion TSX code here"]';
            await page.waitForSelector(editorSelector, { timeout: 10000 });

            // Clear any existing code
            await page.focus(editorSelector);
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');

            // Fill with our TSX code
            await page.fill(editorSelector, block.code);
            console.log('   ✅ Code pasted');

            // Step 3: IMMEDIATELY click "Download 4K" — DON'T wait for preview
            const downloadBtnSelector = 'button:has-text("Download 4K")';
            await page.waitForSelector(downloadBtnSelector, { timeout: 10000 });
            await page.click(downloadBtnSelector);
            console.log('   ✅ Download 4K clicked');

            // Step 4: The "Allow kux-three.vercel.app to see this tab?" pop-up
            // is handled by the --auto-select-desktop-capture-source flag.
            // If it's a browser-level dialog, Playwright's chromium flags handle it.
            // Wait a moment for permission to resolve
            await page.waitForTimeout(2000);

            // Step 5: Wait for the "Stop & Save" button to appear (means recording started)
            const stopBtnSelector = 'button:has-text("Stop & Save")';
            try {
                await page.waitForSelector(stopBtnSelector, { timeout: 15000 });
                console.log('   ✅ Recording started, waiting for auto-download...');
            } catch {
                console.log('   ⚠️  Stop & Save button not found — recording may not have started.');
                console.log('   Skipping this block...');
                continue;
            }

            // Step 6: Wait for auto-download
            // The video auto-downloads when the animation finishes.
            // We listen for the download event with a generous timeout.
            try {
                const download = await page.waitForEvent('download', { timeout: 120000 }); // 2 min max
                const downloadPath = path.join(downloadsDir, `${videoName}.mp4`);
                await download.saveAs(downloadPath);
                console.log(`   ✅ Video saved: ${videoName}.mp4`);
            } catch {
                console.log('   ⚠️  Auto-download did not trigger within timeout.');
                // Fallback: try clicking Stop & Save manually
                try {
                    const stopBtn = await page.$(stopBtnSelector);
                    if (stopBtn) {
                        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
                        await stopBtn.click();
                        const download = await downloadPromise;
                        const downloadPath = path.join(downloadsDir, `${videoName}.mp4`);
                        await download.saveAs(downloadPath);
                        console.log(`   ✅ Video saved (manual stop): ${videoName}.mp4`);
                    }
                } catch {
                    console.log('   ❌ Could not save video for this block.');
                }
            }

        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }

    await browser.close();

    // Summary
    const savedFiles = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.mp4'));
    console.log(`\n\n🎉 Automation complete! ${savedFiles.length}/${blocks.length} videos saved.`);
    console.log(`📁 Videos location: ${downloadsDir}`);
})();
