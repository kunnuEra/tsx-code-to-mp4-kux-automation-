import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    const downloadsDir = path.join(__dirname, '../downloads');
    const inputFile = path.join(__dirname, 'input.txt');

    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir);
    }

    if (!fs.existsSync(inputFile)) {
        console.error('Error: automation/input.txt not found!');
        process.exit(1);
    }

    const inputText = fs.readFileSync(inputFile, 'utf-8');
    console.log('Extracting TSX code blocks...');

    // Use the same regex as the app
    const mdRegex = /```(tsx|typescript|jsx|javascript)\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = mdRegex.exec(inputText)) !== null) {
        blocks.push(match[2].trim());
    }

    // Fallback if no blocks found
    if (blocks.length === 0 && (inputText.includes('import') || (inputText.includes('<') && inputText.includes('/>')))) {
        blocks.push(inputText.trim());
    }

    if (blocks.length === 0) {
        console.log('No TSX blocks found in input.txt. Please ensure you have code wrapped in ```tsx blocks or paste direct code.');
        process.exit(0);
    }

    console.log(`Found ${blocks.length} blocks. Starting automation...`);

    // Launch browser with flags to auto-grant screen recording permission
    const browser = await chromium.launch({
        headless: false, // Set to true for CI
        args: [
            '--use-fake-ui-for-media-stream',
            '--enable-usermedia-screen-capturing',
            // This flag is crucial to auto-select the tab in the "Share this tab" dialog
            '--auto-select-desktop-capture-source="kuTSX - Remotion TSX Preview & Export"',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    for (let i = 0; i < blocks.length; i++) {
        const code = blocks[i];
        const fileName = `video_${Date.now()}_${i + 1}`;
        console.log(`\n--- [${i + 1}/${blocks.length}] Processing ---`);

        try {
            await page.goto('https://kux-three.vercel.app/', { waitUntil: 'networkidle' });

            const editorSelector = 'textarea[placeholder*="Paste Remotion TSX code here"]';
            await page.waitForSelector(editorSelector);

            // Paste the code
            await page.fill(editorSelector, code);
            console.log('Code pasted.');

            // Minimum wait for rendering then click Download
            await page.waitForTimeout(500);

            const downloadBtnSelector = 'button:has-text("Download 4K")';

            // Setup download listener before clicking
            const downloadPromise = page.waitForEvent('download', { timeout: 300000 });

            await page.click(downloadBtnSelector);
            console.log('Clicked Download. Recording should start automatically...');

            console.log('Waiting for video to finish and download to complete...');
            const download = await downloadPromise;
            const downloadPath = path.join(downloadsDir, `${fileName}.mp4`);
            await download.saveAs(downloadPath);

            console.log(`Successfully saved: ${fileName}.mp4`);

        } catch (err) {
            console.error(`Error processing block ${i + 1}:`, err);
        }
    }

    await browser.close();
    console.log('\nAutomation completed!');
})();
