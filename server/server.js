import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import WebsitePerformanceMonitor from './WebsitePerformanceMonitor.js';
import WebsiteSocketMonitor from './WebsiteSocketMonitor.js';
import HeapSnapshotManager from './heapSnapshot.js';
import RealtimeMemoryTracker from './RealtimeMemoryTracker.js';
import lighthouse from 'lighthouse';
import chartHeapData from './heapSnapshot.js';

import {
    measureTimeToTitle,
    measureTimeToRender,
    measureTimeToInteractive,
    measureTTFB,
    launchChromeInstance,
    formatMetric,
    lighthouseConfig
} from './serverFunctions.js';


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working! proceed to work in a better environment' });
});

// Individual metric endpoints
app.post('/api/measure-title-time', async (req, res) => {
    console.log('Received request for title time measurement:', req.body);
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const result = await measureTimeToTitle(url);
    res.json(result);
});

app.post('/api/measure-render-time', async (req, res) => {
    console.log('Received request for render time measurement:', req.body);
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const result = await measureTimeToRender(url);
    res.json(result);
});

app.post('/api/measure-interactive-time', async (req, res) => {
    console.log('Received request for interactive time measurement:', req.body);
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const result = await measureTimeToInteractive(url);
    res.json(result);
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, '192.168.68.110', () => {
    console.log(`Server is running on port ${PORT}`);
});

app.post('/api/measure-ttfb-simple', async (req, res) => {
    console.log('Received request for simple TTFB measurement:', req.body);
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const result = await measureTTFB(url);
    res.json(result);
});

app.post('/api/monitor', async (req, res) => {
    const { url, interval } = req.body;
    const monitor = new WebsitePerformanceMonitor(url);

    try {
        const metrics = await monitor.measurePerformance();
        monitor.startMonitoring(interval || 300000);

        res.json({
            message: 'Monitoring started',
            initialMetrics: metrics
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.post('/api/analyze-sockets', async (req, res) => {
    const { url } = req.body;

    try {
        const monitor = new WebsiteSocketMonitor(url);
        const results = await monitor.analyzeConnections();
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



process.on('SIGINT', async () => {
    await memoryTracker.cleanup();
    process.exit();
});

app.post('/api/analyze', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            error: 'URL is required',
            details: 'Please provide a valid URL to analyze'
        });
    }

    let chrome;
    try {
        console.log('Attempting to launch Chrome...');
        chrome = await launchChromeInstance();
        console.log('Chrome launched successfully on port:', chrome.port);

        console.log('Attempting to run Lighthouse...');
        const results = await lighthouse(url, {
            port: chrome.port,
            output: 'json',
            logLevel: 'info',
            ...lighthouseConfig
        });
        console.log('Lighthouse analysis completed successfully');

        const reportJson = results.lhr;

        res.json({
            url: reportJson.finalUrl,
            fetchTime: reportJson.fetchTime,
            scores: {
                performance: Math.round(reportJson.categories.performance.score * 100),
                accessibility: Math.round(reportJson.categories.accessibility.score * 100),
                bestPractices: Math.round(reportJson.categories['best-practices'].score * 100),
                seo: Math.round(reportJson.categories.seo.score * 100)
            },
            metrics: {
                lcp: formatMetric(reportJson.audits['largest-contentful-paint']),
                fid: formatMetric(reportJson.audits['max-potential-fid']),
                cls: formatMetric(reportJson.audits['cumulative-layout-shift']),
                fcp: formatMetric(reportJson.audits['first-contentful-paint']),
                si: formatMetric(reportJson.audits['speed-index']),
                tti: formatMetric(reportJson.audits['interactive']),
                tbt: formatMetric(reportJson.audits['total-blocking-time']),
                timeToFirstByte: formatMetric(reportJson.audits['server-response-time']),
                firstMeaningfulPaint: formatMetric(reportJson.audits['first-meaningful-paint']),
                loadTime: formatMetric(reportJson.audits['load-fast-enough-for-pwa']),
                layoutShiftElements: reportJson.audits['layout-shift-elements']?.details?.items || [],
                mainThreadWork: reportJson.audits['mainthread-work-breakdown']?.details?.items || [],
                bootupTime: reportJson.audits['bootup-time']?.details?.items || [],
                resourceSummary: reportJson.audits['resource-summary']?.details?.items || []
            },
            opportunities: Object.fromEntries(
                Object.entries(reportJson.audits)
                    .filter(([_, audit]) => audit.details?.type === 'opportunity')
                    .map(([key, audit]) => [key, {
                        title: audit.title,
                        description: audit.description,
                        score: audit.score,
                        numericValue: audit.numericValue,
                        displayValue: audit.displayValue,
                        details: audit.details
                    }])
            ),
            audits: Object.fromEntries(
                Object.entries(reportJson.audits)
                    .map(([key, audit]) => [key, {
                        title: audit.title,
                        description: audit.description,
                        score: audit.score,
                        displayValue: audit.displayValue,
                        numericValue: audit.numericValue,
                        details: audit.details
                    }])
            ),
            configSettings: reportJson.configSettings,
            environment: {
                networkUserAgent: reportJson.environment.networkUserAgent,
                hostUserAgent: reportJson.environment.hostUserAgent,
                benchmarkIndex: reportJson.environment.benchmarkIndex
            },
            runWarnings: reportJson.runWarnings
        });

    } catch (error) {
        console.error('Error during analysis:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Analysis failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (chrome) {
            try {
                console.log('Attempting to close Chrome...');
                await chrome.kill();
                console.log('Chrome instance successfully closed');
            } catch (error) {
                console.error('Error closing Chrome:', error);
            }
        }
    }
});





// Endpoint to run heap snapshot analysis
app.post('/api/heap-snapshot', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            error: 'URL is required',
            details: 'Please provide a valid URL to analyze'
        });
    }

    try {
        const heapData = await chartHeapData(url);
        res.json({
            success: true,
            url: url,
            heapData: heapData
        });
    } catch (error) {
        console.error('Heap snapshot analysis failed:', error);
        res.status(500).json({
            error: 'Heap snapshot analysis failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});






// New combined endpoint with SSE
app.post('/api/analyze-all', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            error: 'URL is required',
            details: 'Please provide a valid URL to analyze'
        });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const sendUpdate = (stage, data) => {
        res.write(`data: ${JSON.stringify({ stage, data })}\n\n`);
    };

    const results = {};
    let chrome;

    try {
        console.log('Starting analysis for URL:', url);

        // Measure Title Time
        sendUpdate('titleTime', 'started');
        results.titleTime = await measureTimeToTitle(url);
        sendUpdate('titleTime', results.titleTime);

        // Measure Render Time
        sendUpdate('renderTime', 'started');
        results.renderTime = await measureTimeToRender(url);
        sendUpdate('renderTime', results.renderTime);

        // Measure Interactive Time
        sendUpdate('interactiveTime', 'started');
        results.interactiveTime = await measureTimeToInteractive(url);
        sendUpdate('interactiveTime', results.interactiveTime);

        // Measure TTFB
        sendUpdate('ttfb', 'started');
        results.ttfb = await measureTTFB(url);
        sendUpdate('ttfb', results.ttfb);

        // Analyze Sockets
        sendUpdate('socketAnalysis', 'started');
        const monitor = new WebsiteSocketMonitor(url);
        results.socketAnalysis = await monitor.analyzeConnections();
        sendUpdate('socketAnalysis', results.socketAnalysis);

        // Lighthouse Analysis
        sendUpdate('lighthouseAnalysis', 'started');
        chrome = await launchChromeInstance();
        const lighthouseResults = await lighthouse(url, {
            port: chrome.port,
            output: 'json',
            logLevel: 'info',
            ...lighthouseConfig
        });
        const reportJson = lighthouseResults.lhr;
        results.lighthouseAnalysis = {
            url: reportJson.finalUrl,
            fetchTime: reportJson.fetchTime,
            scores: {
                performance: Math.round(reportJson.categories.performance.score * 100),
                accessibility: Math.round(reportJson.categories.accessibility.score * 100),
                bestPractices: Math.round(reportJson.categories['best-practices'].score * 100),
                seo: Math.round(reportJson.categories.seo.score * 100)
            },
            metrics: {
                lcp: formatMetric(reportJson.audits['largest-contentful-paint']),
                fid: formatMetric(reportJson.audits['max-potential-fid']),
                cls: formatMetric(reportJson.audits['cumulative-layout-shift']),
                fcp: formatMetric(reportJson.audits['first-contentful-paint']),
                si: formatMetric(reportJson.audits['speed-index']),
                tti: formatMetric(reportJson.audits['interactive']),
                tbt: formatMetric(reportJson.audits['total-blocking-time']),
                timeToFirstByte: formatMetric(reportJson.audits['server-response-time']),
                firstMeaningfulPaint: formatMetric(reportJson.audits['first-meaningful-paint']),
                loadTime: formatMetric(reportJson.audits['load-fast-enough-for-pwa'])
            }
        };
        sendUpdate('lighthouseAnalysis', results.lighthouseAnalysis);

        // Heap Snapshot Analysis
        sendUpdate('heapSnapshot', 'started');
        console.log('Starting heap snapshot analysis');
        results.heapSnapshot = await chartHeapData(url);
        sendUpdate('heapSnapshot', results.heapSnapshot);
        console.log('Heap snapshot analysis completed or failed');



        // Send final results
        sendUpdate('complete', { success: true, url: url, results: results });

        console.log('Analysis completed successfully');


        // Send final results using res
        res.write(`data: ${JSON.stringify({
            stage: 'complete',
            data: {
                success: true,
                url: url,
                results: results
            }
        })}\n\n`);
    } catch (error) {
        console.error('Error during analysis:', error);
        console.error('Error stack:', error.stack);
        sendUpdate('error', {
            error: 'Analysis failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

    } finally {
        if (chrome) {
            try {
                await chrome.kill();
            } catch (error) {
                console.error('Error closing Chrome:', error);
            }
        }
        // End the SSE connection
        res.end();
    }
});