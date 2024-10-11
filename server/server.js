import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Since we're using CommonJS style in the existing server, we'll use the fetch API that's built into Node.js now
// const { fetch } = await import('node-fetch');
import { parse } from 'node-html-parser';
import { performance } from 'perf_hooks';
import puppeteer from 'puppeteer';
import WebsitePerformanceMonitor from './WebsitePerformanceMonitor.js';
import os from 'os';
import WebsiteSocketMonitor from './WebsiteSocketMonitor.js';




// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working! proceed to work in a better environment' });
});

// Time to Title measurement function
async function measureTimeToTitle(url) {
    try {
        const startTime = performance.now();
        const response = await fetch(url);
        const html = await response.text();
        const root = parse(html);
        const title = root.querySelector('title');
        const endTime = performance.now();
        
        return {
            success: true,
            url: url,
            title: title ? title.text : 'No title found',
            timeToTitle: (endTime - startTime).toFixed(2),
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in measureTimeToTitle:', error);
        return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Time to Render measurement function
async function measureTimeToRender(url) {
    let browser = null;
    try {
        const startTime = performance.now();
        
        browser = await puppeteer.launch({
            headless: "shell",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        // Inject performance observer before navigation
        await page.evaluateOnNewDocument(() => {
            window.largestContentfulPaint = 0;
            
            const observer = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                window.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
            });
            
            observer.observe({ 
                entryTypes: ['largest-contentful-paint']
            });
        });

        // Navigate to page and wait for load
        await page.goto(url, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 30000
        });

       

        // Get all performance metrics including LCP
        const performanceMetrics = await page.evaluate(() => {
            return {
                firstPaint: performance.getEntriesByType('paint')
                    .find(entry => entry.name === 'first-paint')?.startTime,
                firstContentfulPaint: performance.getEntriesByType('paint')
                    .find(entry => entry.name === 'first-contentful-paint')?.startTime,
                domComplete: performance.timing.domComplete - performance.timing.navigationStart,
                largestContentfulPaint: window.largestContentfulPaint
            };
        });

        const endTime = performance.now();

        // Get CPU usage
        const cpuUsage = process.cpuUsage();
        const totalCPUUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

        // Calculate CPU usage percentage
        const cpuCount = os.cpus().length;
        const elapsedTime = (endTime - startTime) / 1000; // Convert to seconds
        const cpuUsagePercentage = (totalCPUUsage / (cpuCount * elapsedTime)) * 100;

        await browser.close();
        browser = null;

        return {
            success: true,
            url: url,
            timeToRender: (endTime - startTime).toFixed(2),
            firstPaint: performanceMetrics.firstPaint?.toFixed(2) || null,
            firstContentfulPaint: performanceMetrics.firstContentfulPaint?.toFixed(2) || null,
            largestContentfulPaint: performanceMetrics.largestContentfulPaint?.toFixed(2) || null,
            domComplete: performanceMetrics.domComplete?.toFixed(2) || null,
            totalCPUUsage: totalCPUUsage.toFixed(2),
            cpuUsagePercentage: cpuUsagePercentage.toFixed(2),
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in measureTimeToRender:', error);
        if (browser) await browser.close();
        return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}


// Time to Interactive measurement function
async function measureTimeToInteractive(url) {
    let browser = null;
    try {
        const startTime = performance.now();
        
        // Launch browser with specific args to avoid common issues
        browser = await puppeteer.launch({
            headless: "shell",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });

        // Navigate to page and wait for load
        await page.goto(url, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 30000
        });

        // Wait for network to be idle and no long tasks
        const tti = await page.evaluate(() => {
            return new Promise((resolve) => {
                let lastLongTaskTime = 0;
                let timeoutId;

                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        lastLongTaskTime = performance.now();
                    }
                });

                observer.observe({ entryTypes: ['longtask'] });

                const checkInteractive = () => {
                    const timeSinceLastLongTask = performance.now() - lastLongTaskTime;
                    if (timeSinceLastLongTask >= 5000) { // 5 seconds without long tasks
                        observer.disconnect();
                        resolve(performance.now());
                    } else {
                        timeoutId = setTimeout(checkInteractive, 100);
                    }
                };

                // Start checking after initial page load
                timeoutId = setTimeout(checkInteractive, 100);

                // Timeout after 30 seconds
                setTimeout(() => {
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    resolve(performance.now());
                }, 30000);
            });
        });

        const metrics = await page.metrics();
        const endTime = performance.now();
        
        await browser.close();
        browser = null;

        return {
            success: true,
            url: url,
            timeToInteractive: (endTime - startTime).toFixed(2),
            timeToFirstInteractive: tti?.toFixed(2) || null,
            scriptDuration: metrics.ScriptDuration?.toFixed(2) || null,
            layoutDuration: metrics.LayoutDuration?.toFixed(2) || null,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in measureTimeToInteractive:', error);
        if (browser) await browser.close();
        return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

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

// Combined metrics endpoint
app.post('/api/measure-all-metrics', async (req, res) => {
    console.log('Received request for all metrics:', req.body);
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }

    try {
        const [titleResults, renderResults, interactiveResults] = await Promise.all([
            measureTimeToTitle(url),
            measureTimeToRender(url),
            measureTimeToInteractive(url)
        ]);

        res.json({
            success: true,
            url,
            metrics: {
                titleTiming: titleResults,
                renderTiming: renderResults,
                interactiveTiming: interactiveResults
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in combined metrics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to measure metrics',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



async function measureTTFB(url) {
    try {
        const startTime = performance.now();
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        const endTime = performance.now();
        const ttfb = endTime - startTime;

        // Get additional timing information if available
        const timingInfo = {
            dnsLookup: null,
            tcpConnection: null,
            tlsNegotiation: null,
            serverProcessing: null
        };

        // Some browsers/environments provide detailed timing info
        if (response.timing) {
            const timing = response.timing;
            timingInfo.dnsLookup = timing.domainLookupEnd - timing.domainLookupStart;
            timingInfo.tcpConnection = timing.connectEnd - timing.connectStart;
            timingInfo.tlsNegotiation = timing.secureConnectionStart > 0 ? 
                timing.connectEnd - timing.secureConnectionStart : null;
            timingInfo.serverProcessing = timing.responseStart - timing.requestStart;
        }

        return {
            success: true,
            url: url,
            ttfb: ttfb.toFixed(2),
            ...timingInfo,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in measureTTFB:', error);
        return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

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
        // Get initial metrics
        const metrics = await monitor.measurePerformance();
        
        // Start continuous monitoring
        monitor.startMonitoring(interval || 300000); // 5 minutes default
        
        res.json({
            message: 'Monitoring started',
            initialMetrics: metrics
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create an endpoint to get current metrics for a specific URL
app.get('/api/metrics/:url', async (req, res) => {
    const monitor = new WebsitePerformanceMonitor(decodeURIComponent(req.params.url));
    const metrics = await monitor.measurePerformance();
    res.json(metrics);
});


// Create an endpoint to analyze sockets for a website
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

// Create an endpoint to start continuous monitoring
app.post('/api/monitor-sockets', async (req, res) => {
    const { url, interval } = req.body;
    
    try {
        const monitor = new WebsiteSocketMonitor(url);
        const initialResults = await monitor.analyzeConnections();
        monitor.startMonitoring(interval || 60000); // 1 minute default
        
        res.json({
            message: 'Socket monitoring started',
            initialResults
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// MEMORY TRACKIG ON LOAD


import RealtimeMemoryTracker from './RealtimeMemoryTracker.js';



const memoryTracker = new RealtimeMemoryTracker();

// Initialize the tracker
memoryTracker.initialize().catch(console.error);

// Endpoint to track memory usage
app.post('/api/track-memory', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const results = await memoryTracker.trackMemoryUsage(url);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Cleanup on server shutdown
process.on('SIGINT', async () => {
    await memoryTracker.cleanup();
    process.exit();
});





// import lighthouse from 'lighthouse';
// import * as chromeLauncher from 'chrome-launcher';
// // const router = express.Router();

// // Utility function to launch Chrome
// async function launchChromeInstance() {
//   return await chromeLauncher.launch({
//     chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
//   });
// }

// // Main lighthouse analysis endpoint
// app.post('/api/analyze', async (req, res) => {
//   const { url } = req.body;
  
//   if (!url) {
//     return res.status(400).json({ error: 'URL is required' });
//   }

//   let chrome;
//   try {
//     // Launch Chrome
//     chrome = await launchChromeInstance();
    
//     // Run Lighthouse
//     const results = await lighthouse(url, {
//       port: chrome.port,
//       output: 'json',
//       logLevel: 'info',
//       onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
//     });

//     // Process the results
//     const reportJson = results.lhr;
    
//     // Send back formatted results
//     res.json({
//       scores: {
//         performance: reportJson.categories.performance.score * 100,
//         accessibility: reportJson.categories.accessibility.score * 100,
//         bestPractices: reportJson.categories['best-practices'].score * 100,
//         seo: reportJson.categories.seo.score * 100,
//         fcp: reportJson.audits['first-contentful-paint'].numericValue,
//         lcp: reportJson.audits['largest-contentful-paint'].numericValue,
//         fid: reportJson.audits['first-input-delay'].numericValue,
//         cls: reportJson.audits['layout-shift-elements'].numericValue
//       },
//       audits: reportJson.audits
//     });

//   } catch (error) {
//     console.error('Lighthouse analysis failed:', error);
//     res.status(500).json({ error: 'Analysis failed' });
//   } finally {
//     if (chrome) {
//       await chrome.kill();
//     }
//   }
// });



import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

// Lighthouse configuration
const lighthouseConfig = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
  }
};

// Utility function to format metric values
function formatMetric(audit) {
  if (!audit) return null;
  return {
    score: audit.score,
    numericValue: audit.numericValue,
    displayValue: audit.displayValue
  };
}

// Utility function to launch Chrome
async function launchChromeInstance() {
  return await chromeLauncher.launch({
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
}

// Main lighthouse analysis endpoint
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
    // Launch Chrome
    chrome = await launchChromeInstance();
    console.log('Chrome launched successfully on port:', chrome.port);
    
    // Run Lighthouse
    const results = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'info',
      ...lighthouseConfig
    });

    const reportJson = results.lhr;
    
    // Process and send back formatted results
    res.json({
      url: reportJson.finalUrl,
      fetchTime: reportJson.fetchTime,
      
      // Main category scores
      scores: {
        performance: Math.round(reportJson.categories.performance.score * 100),
        accessibility: Math.round(reportJson.categories.accessibility.score * 100),
        bestPractices: Math.round(reportJson.categories['best-practices'].score * 100),
        seo: Math.round(reportJson.categories.seo.score * 100)
      },

      // Core Web Vitals and other key metrics
      metrics: {
        // Core Web Vitals
        lcp: formatMetric(reportJson.audits['largest-contentful-paint']),
        fid: formatMetric(reportJson.audits['max-potential-fid']), // Note: Lab FID equivalent
        cls: formatMetric(reportJson.audits['cumulative-layout-shift']),
        
        // Additional Important Metrics
        fcp: formatMetric(reportJson.audits['first-contentful-paint']),
        si: formatMetric(reportJson.audits['speed-index']),
        tti: formatMetric(reportJson.audits['interactive']),
        tbt: formatMetric(reportJson.audits['total-blocking-time']),

        // Performance Metrics
        timeToFirstByte: formatMetric(reportJson.audits['server-response-time']),
        firstMeaningfulPaint: formatMetric(reportJson.audits['first-meaningful-paint']),
        loadTime: formatMetric(reportJson.audits['load-fast-enough-for-pwa']),
        
        // Layout Shifts
        layoutShiftElements: reportJson.audits['layout-shift-elements']?.details?.items || [],
        
        // Performance Breakdown
        mainThreadWork: reportJson.audits['mainthread-work-breakdown']?.details?.items || [],
        bootupTime: reportJson.audits['bootup-time']?.details?.items || [],
        
        // Resource Summary
        resourceSummary: reportJson.audits['resource-summary']?.details?.items || []
      },

      // Detailed opportunities and diagnostics
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

      // Full audit data
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

      // Configuration used
      configSettings: reportJson.configSettings,
      
      // Environment information
      environment: {
        networkUserAgent: reportJson.environment.networkUserAgent,
        hostUserAgent: reportJson.environment.hostUserAgent,
        benchmarkIndex: reportJson.environment.benchmarkIndex
      },

      // Any warnings that occurred during the run
      runWarnings: reportJson.runWarnings
    });

  } catch (error) {
    console.error('Lighthouse analysis failed:', error);
    res.status(500).json({ 
      error: 'Analysis failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
        console.log('Chrome instance successfully closed');
      } catch (error) {
        console.error('Error closing Chrome:', error);
      }
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
