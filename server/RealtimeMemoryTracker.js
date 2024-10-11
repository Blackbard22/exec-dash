import puppeteer from 'puppeteer';

// Constants for wait conditions
const DEFAULT_NETWORK_QUIET_THRESHOLD = 5000;
const DEFAULT_PAUSE_AFTER_LOAD = 1000;
const DEFAULT_MAX_WAIT_FOR_LOAD = 30000;

class RealtimeMemoryTracker {
    constructor() {
        this.browser = null;
        this.measurements = [];
        this.startTime = null;
        this.navigationUrls = {
            requested: null,
            final: null
        };
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: 'shell',
            args: ['--no-sandbox']
        });
    }

    async waitForNetworkIdle(page, networkQuietThreshold = DEFAULT_NETWORK_QUIET_THRESHOLD) {
        return new Promise((resolve) => {
            let lastRequestTime = Date.now();
            let timeoutId = null;

            const requestHandler = () => {
                lastRequestTime = Date.now();
                if (timeoutId) clearTimeout(timeoutId);
                
                timeoutId = setTimeout(() => {
                    page.removeListener('request', requestHandler);
                    page.removeListener('response', requestHandler);
                    resolve();
                }, networkQuietThreshold);
            };

            page.on('request', requestHandler);
            page.on('response', requestHandler);

            // Initial timeout
            timeoutId = setTimeout(() => {
                page.removeListener('request', requestHandler);
                page.removeListener('response', requestHandler);
                resolve();
            }, networkQuietThreshold);
        });
    }

    async waitForFullyLoaded(page, options = {}) {
        const {
            networkQuietThreshold = DEFAULT_NETWORK_QUIET_THRESHOLD,
            maxWaitForLoad = DEFAULT_MAX_WAIT_FOR_LOAD,
            pauseAfterLoad = DEFAULT_PAUSE_AFTER_LOAD
        } = options;

        let loadTimeout;
        
        try {
            // Wait for initial load event with timeout
            const loadPromise = new Promise(resolve => page.once('load', resolve));
            const timeoutPromise = new Promise((_, reject) => {
                loadTimeout = setTimeout(() => {
                    reject(new Error('Page load timed out'));
                }, maxWaitForLoad);
            });

            await Promise.race([loadPromise, timeoutPromise]);

            // Wait for network to be idle
            await this.waitForNetworkIdle(page, networkQuietThreshold);

            // Additional pause after load if specified
            if (pauseAfterLoad) {
                await new Promise(resolve => setTimeout(resolve, pauseAfterLoad));
            }

            return { timedOut: false };
        } catch (error) {
            return { timedOut: true };
        } finally {
            if (loadTimeout) clearTimeout(loadTimeout);
        }
    }

    async trackMemoryUsage(url) {
        if (!this.browser) {
            await this.initialize();
        }

        const page = await this.browser.newPage();
        this.measurements = [];
        this.navigationUrls.requested = url;
        
        // Enable request interception and CDP session
        await page.setRequestInterception(true);
        const client = await page.target().createCDPSession();
        await client.send('Performance.enable');

        let navigationComplete = false;
        let intervalId;

        try {
            // Start memory tracking
            intervalId = setInterval(async () => {
                if (!page.isClosed()) {
                    try {
                        const metrics = await this.captureMetrics(page);
                        const timeElapsed = this.startTime ? Date.now() - this.startTime : 0;
                        
                        if (metrics) {
                            this.measurements.push({
                                timeElapsed,
                                ...metrics,
                                navigationState: navigationComplete ? 'complete' : 'in-progress'
                            });
                        }
                    } catch (error) {
                        if (!error.message.includes('Page is navigating')) {
                            console.error('Metric capture error:', error);
                        }
                    }
                }
            }, 100);

            // Track navigation start
            page.on('request', request => {
                if (request.isNavigationRequest()) {
                    this.startTime = Date.now();
                    this.navigationUrls.final = request.url();
                }
                request.continue();
            });

            // Wait for navigation and load
            const loadResult = await this.waitForFullyLoaded(page, {
                networkQuietThreshold: DEFAULT_NETWORK_QUIET_THRESHOLD,
                maxWaitForLoad: DEFAULT_MAX_WAIT_FOR_LOAD,
                pauseAfterLoad: DEFAULT_PAUSE_AFTER_LOAD
            });

            navigationComplete = true;

            // Capture final metrics
            const finalMetrics = await this.captureMetrics(page);
            this.measurements.push({
                timeElapsed: Date.now() - this.startTime,
                ...finalMetrics,
                isComplete: true
            });

            // Process and return results
            return {
                url: this.navigationUrls.final || url,
                loadTime: Date.now() - this.startTime,
                timedOut: loadResult.timedOut,
                measurements: this.processMeasurements(this.measurements),
                warnings: this.getNavigationWarnings()
            };

        } catch (error) {
            console.error('Navigation error:', error);
            throw error;
        } finally {
            if (intervalId) clearInterval(intervalId);
            if (!page.isClosed()) await page.close();
        }
    }

    getNavigationWarnings() {
        const warnings = [];
        
        if (this.navigationUrls.requested !== this.navigationUrls.final) {
            warnings.push({
                message: 'Page redirected',
                requested: this.navigationUrls.requested,
                final: this.navigationUrls.final
            });
        }

        return warnings;
    }

    async captureMetrics(page) {
        try {
            const metrics = await page.evaluate(() => {
                const memory = window.performance.memory || {};
                return {
                    jsHeapSize: memory.usedJSHeapSize || 0,
                    totalHeapSize: memory.totalJSHeapSize || 0,
                    heapLimit: memory.jsHeapSizeLimit || 0,
                    domNodes: document.getElementsByTagName('*').length,
                    resources: performance.getEntriesByType('resource').length
                };
            });

            const processMemory = process.memoryUsage();

            return {
                timestamp: new Date().toISOString(),
                jsHeapSize: Math.round(metrics.jsHeapSize / 1024 / 1024),
                totalHeapSize: Math.round(metrics.totalHeapSize / 1024 / 1024),
                heapLimit: Math.round(metrics.heapLimit / 1024 / 1024),
                processMemory: Math.round(processMemory.heapUsed / 1024 / 1024),
                domNodes: metrics.domNodes,
                resources: metrics.resources
            };
        } catch (error) {
            if (error.message.includes('Page is navigating')) {
                return null;
            }
            throw error;
        }
    }

    processMeasurements(measurements) {
        const validMeasurements = measurements.filter(m => m !== null)
            .sort((a, b) => a.timeElapsed - b.timeElapsed);
        
        return validMeasurements.map((m, index) => {
            const rate = index > 0 
                ? (m.jsHeapSize - validMeasurements[index-1].jsHeapSize) / 
                  (m.timeElapsed - validMeasurements[index-1].timeElapsed)
                : 0;

            return {
                ...m,
                memoryRate: Math.round(rate * 100) / 100,
                percentageOfLimit: Math.round((m.jsHeapSize / m.heapLimit) * 100)
            };
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export default RealtimeMemoryTracker;

