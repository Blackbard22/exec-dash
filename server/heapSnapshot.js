import puppeteer from 'puppeteer';
import CDP from 'chrome-remote-interface';
import fs from 'fs';

async function chartHeapData(url) {
    let browser;
    let client;
    const heapMeasurements = [];

    try {
        // Launch a new browser instance with additional flags for precise memory info
        browser = await puppeteer.launch({
            headless: 'shell',
            args: [
                '--remote-debugging-port=9222',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--enable-precise-memory-info',      // Added flag for detailed memory information
                '--js-flags=--expose-gc'            // Added flag to expose garbage collection
            ]
        });

        // Wait a moment to ensure the browser is fully launched
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Connect to the Chrome instance
        client = await CDP();
        const { Page, Runtime, HeapProfiler } = client;

        // Enable the required domains
        await Page.enable();
        await Runtime.enable();
        await HeapProfiler.enable();

        // Function to take heap usage measurements
        const takeHeapMeasurement = async (timestamp) => {
            console.log(`Taking heap measurement at timestamp: ${timestamp}`);
            try {
                // Force garbage collection to get a more accurate measurement
                await Runtime.evaluate({ expression: 'if (window.gc) { window.gc() }' });

                const result = await Runtime.evaluate({
                    expression: 'performance.memory.usedJSHeapSize',
                    returnByValue: true
                });
                const usedSize = result.result.value;
                heapMeasurements.push({ timestamp, usedSize });
                console.log(`Heap measurement taken at timestamp ${timestamp}: ${usedSize} bytes`);
                //experimatnat
                console.log("######Experimeental heap usage value######")   
                const heapUsage = await Runtime.getHeapUsage();
                // console.log(`heapUsage: ${heapUsage} bytes`);
                console.log(heapUsage);
            } catch (error) {
                console.error(`Error taking heap measurement: ${error.message}`);
            }
        };

        // Start taking measurements when the page starts loading
        const startTime = Date.now();
        const measurementInterval = setInterval(() => {
            const timestamp = Date.now() - startTime;
            takeHeapMeasurement(timestamp);
        }, 100); // Taking measurements every 100ms

        // Navigate to the target URL
        await Page.navigate({ url });

        // Wait for the page to fully load
        await Page.loadEventFired();

        // Stop taking measurements after the page loads and wait for a final measurement
        await new Promise(resolve => setTimeout(resolve, 2000)); // Additional wait time to capture final state
        clearInterval(measurementInterval);
        
        // Take a final measurement
        await takeHeapMeasurement(Date.now() - startTime);

        // Save measurements to a file
        // fs.writeFileSync('heap_measurements.json', JSON.stringify(heapMeasurements, null, 2));
        // console.log('Heap measurements saved to heap_measurements.json');
        
        return heapMeasurements;
    } catch (error) {
        console.error('Error during heap measurement collection:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}

export default chartHeapData;



// import CDP from 'chrome-remote-interface';
// import fs from 'fs/promises';
// import path from 'path';

// class HeapSnapshotManager {
//   constructor(options = {}) {
//     this.options = {
//       maxSnapshots: options.maxSnapshots || 10,
//       // snapshotDir: options.snapshotDir || './heap-snapshots', // Removed snapshotDir
//       port: options.port || 9222,
//     };
    
//     this.snapshots = [];
//     this.client = null;
//   }

//   async initialize() {
//     try {
//       // Removed directory creation
//       // await fs.mkdir(this.options.snapshotDir, { recursive: true });
      
//       // Connect to Chrome CDP
//       this.client = await CDP({
//         port: this.options.port
//       });

//       // Enable necessary domains
//       const { HeapProfiler, Memory } = this.client;

//       await Promise.all([
//         HeapProfiler.enable(),
//         Memory.enable()
//       ]);

//       console.log('Heap Snapshot Manager initialized');
//     } catch (error) {
//       console.error('Failed to initialize Heap Snapshot Manager:', error);
//       throw error;
//     }
//   }

//   async takeSnapshot(url) {
//     if (!this.client) {
//       throw new Error('HeapSnapshotManager not initialized');
//     }

//     try {
//       const { HeapProfiler, Memory, Page } = this.client;
      
//       // Navigate to the URL first
//       await Page.enable();
//       await Page.navigate({ url });
//       await Page.loadEventFired();
      
//       // Wait a bit for any post-load scripts
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // Get memory metrics
//       const metrics = await Memory.getBrowserMemoryMetrics();
      
//       // Take heap snapshot
//       let chunks = [];
      
//       HeapProfiler.addHeapSnapshotChunk((params) => {
//         chunks.push(params.chunk);
//       });

//       await HeapProfiler.takeHeapSnapshot({ reportProgress: false });
      
//       // Create snapshot data object
//       const timestamp = new Date().toISOString();
//       const snapshotData = {
//         url,
//         timestamp,
//         metrics,
//         heapUsage: {
//           totalJSHeapSize: metrics.find(m => m.name === 'JSHeapTotalSize')?.value,
//           usedJSHeapSize: metrics.find(m => m.name === 'JSHeapUsedSize')?.value,
//           heapSizeLimit: metrics.find(m => m.name === 'JSHeapSizeLimit')?.value,
//         },
//         snapshotChunks: chunks.join('')
//       };

//       // Save snapshot to array
//       this.snapshots.push(snapshotData);

//       // Keep only the most recent snapshots
//       if (this.snapshots.length > this.options.maxSnapshots) {
//         this.snapshots.shift();
//       }

//       return snapshotData.heapUsage;
//     } catch (error) {
//       console.error('Failed to take heap snapshot:', error);
//       throw error;
//     }
//   }

//   async getSnapshots() {
//     return this.snapshots;
//   }

//   async cleanup() {
//     try {
//       if (this.client) {
//         await this.client.close();
//         this.client = null;
//       }
      
//       // Clear snapshots array
//       this.snapshots = [];
      
//     } catch (error) {
//       console.error('Error during cleanup:', error);
//       throw error;
//     }
//   }
// }

// export default HeapSnapshotManager;
















// import CDP from 'chrome-remote-interface';
// import fs from 'fs/promises';
// import path from 'path';

// class HeapSnapshotManager {
//   constructor(options = {}) {
//     this.options = {
//       maxSnapshots: options.maxSnapshots || 10,
//       snapshotDir: options.snapshotDir || './heap-snapshots',
//       port: options.port || 9222,
//     };
    
//     this.snapshots = [];
//     this.client = null;
//   }

//   async initialize() {
//     try {
//       // Ensure snapshot directory exists
//       await fs.mkdir(this.options.snapshotDir, { recursive: true });
      
//       // Connect to Chrome CDP
//       this.client = await CDP({
//         port: this.options.port
//       });

//       // Enable necessary domains
//       const { Heaprofiler, Memory } = this.client;
//       await Promise.all([
//         Heaprofiler.enable(),
//         Memory.enable()
//       ]);

//       console.log('Heap Snapshot Manager initialized');
//     } catch (error) {
//       console.error('Failed to initialize Heap Snapshot Manager:', error);
//       throw error;
//     }
//   }

//   async takeSnapshot(url) {
//     if (!this.client) {
//       throw new Error('HeapSnapshotManager not initialized');
//     }

//     try {
//       const { Heaprofiler, Memory, Page } = this.client;
      
//       // Navigate to the URL first
//       await Page.enable();
//       await Page.navigate({ url });
//       await Page.loadEventFired();
      
//       // Wait a bit for any post-load scripts
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // Get memory metrics
//       const metrics = await Memory.getBrowserMemoryMetrics();
      
//       // Take heap snapshot
//       let chunks = [];
      
//       Heaprofiler.addHeapSnapshotChunk((params) => {
//         chunks.push(params.chunk);
//       });

//       await Heaprofiler.takeHeapSnapshot({ reportProgress: false });
      
//       // Create snapshot data object
//       const timestamp = new Date().toISOString();
//       const snapshotData = {
//         url,
//         timestamp,
//         metrics,
//         heapUsage: {
//           totalJSHeapSize: metrics.find(m => m.name === 'JSHeapTotalSize')?.value,
//           usedJSHeapSize: metrics.find(m => m.name === 'JSHeapUsedSize')?.value,
//           heapSizeLimit: metrics.find(m => m.name === 'JSHeapSizeLimit')?.value,
//         },
//         snapshotChunks: chunks.join('')
//       };

//       // Save snapshot
//       const fileName = `heap-snapshot-${timestamp}.json`;
//       const filePath = path.join(this.options.snapshotDir, fileName);
      
//       await fs.writeFile(filePath, JSON.stringify(snapshotData, null, 2));
      
//       // Manage snapshots array
//       this.snapshots.push({
//         url,
//         timestamp,
//         filePath,
//         metrics: snapshotData.heapUsage
//       });

//       // Keep only the most recent snapshots
//       if (this.snapshots.length > this.options.maxSnapshots) {
//         const oldestSnapshot = this.snapshots.shift();
//         await fs.unlink(oldestSnapshot.filePath);
//       }

//       return snapshotData.heapUsage;
//     } catch (error) {
//       console.error('Failed to take heap snapshot:', error);
//       throw error;
//     }
//   }

//   async getSnapshots() {
//     return this.snapshots;
//   }

//   async cleanup() {
//     try {
//       if (this.client) {
//         await this.client.close();
//         this.client = null;
//       }
      
//       // Clear snapshots directory
//       for (const snapshot of this.snapshots) {
//         await fs.unlink(snapshot.filePath).catch(() => {});
//       }
//       this.snapshots = [];
      
//     } catch (error) {
//       console.error('Error during cleanup:', error);
//       throw error;
//     }
//   }
// }

// export default HeapSnapshotManager;