import axios from 'axios'
import process from 'process'

class WebsitePerformanceMonitor {
    constructor(url) {
        this.url = url;
        this.metrics = {
            responseTime: 0,
            memory: {},
            cpu: {},
            status: '',
            timestamp: null
        };
    }

    async measurePerformance() {
        const startMemory = process.memoryUsage();
        const startCPU = process.cpuUsage();
        const startTime = process.hrtime();

        try {
            // Make the request to the website
            const response = await axios.get(this.url, {
                timeout: 30000,
                validateStatus: false
            });

            // Calculate response time
            const endTime = process.hrtime(startTime);
            const responseTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);

            // Calculate memory and CPU usage difference
            const endMemory = process.memoryUsage();
            const endCPU = process.cpuUsage(startCPU);

            this.metrics = {
                url: this.url,
                status: response.status,
                responseTime: `${responseTimeMs}ms`,
                memory: {
                    heapUsed: this.formatBytes(endMemory.heapUsed - startMemory.heapUsed),
                    heapTotal: this.formatBytes(endMemory.heapTotal),
                    rss: this.formatBytes(endMemory.rss),
                    external: this.formatBytes(endMemory.external)
                },
                cpu: {
                    user: `${(endCPU.user / 1000000).toFixed(2)}s`,
                    system: `${(endCPU.system / 1000000).toFixed(2)}s`
                },
                headers: {
                    server: response.headers.server || 'N/A',
                    'content-type': response.headers['content-type'] || 'N/A',
                    'content-length': this.formatBytes(parseInt(response.headers['content-length']) || 0)
                },
                timestamp: new Date().toISOString()
            };

            return this.metrics;

        } catch (error) {
            return {
                url: this.url,
                status: 'Error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    async startMonitoring(interval = 10 * 1000) { // Default 10 seconds
        console.log(`Starting monitoring for ${this.url} every ${interval / 1000} seconds`);

        // Initial measurement
        await this.measurePerformance();
        console.log("Initial measurement complete");

        // Set up interval for continuous monitoring
        const intervalId = setInterval(async () => {
            console.log(`Interval triggered at ${new Date().toISOString()}`);
            try {
                await this.measurePerformance();
                console.log(`\n--- Performance Report for ${this.url} ---`);
                console.log(JSON.stringify(this.metrics, null, 2));
            } catch (error) {
                console.error("Error during performance measurement:", error);
            }
        }, interval);

        console.log(`Interval set up with ID: ${intervalId}`);
        return intervalId;
    }
}

export default WebsitePerformanceMonitor;