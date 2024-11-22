
import dotenv from 'dotenv';
import { parse } from 'node-html-parser';
import { performance } from 'perf_hooks';
import puppeteer from 'puppeteer';

import os from 'os';

import * as chromeLauncher from 'chrome-launcher';

// Load environment variables
dotenv.config();

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
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
        logLevel: 'info',
        output: 'json',
        port: 9222 // Use a fixed port for Chrome
    });
}

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

        browser = await puppeteer.launch({
            headless: "shell",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        await page.goto(url, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 30000
        });

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
                    if (timeSinceLastLongTask >= 5000) {
                        observer.disconnect();
                        resolve(performance.now());
                    } else {
                        timeoutId = setTimeout(checkInteractive, 100);
                    }
                };

                timeoutId = setTimeout(checkInteractive, 100);

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

        const timingInfo = {
            dnsLookup: null,
            tcpConnection: null,
            tlsNegotiation: null,
            serverProcessing: null
        };

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

export {
    measureTimeToTitle,
    measureTimeToRender,
    measureTimeToInteractive,
    measureTTFB,
    launchChromeInstance,
    formatMetric,
    lighthouseConfig
};
