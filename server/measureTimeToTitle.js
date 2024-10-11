import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import { parse } from 'node-html-parser';

async function measureTimeToTitle(url) {
    try {
        
        const startTime = performance.now();
        
        // Make the request and get the response
        const response = await fetch(url);
        const html = await response.text();
        
        // Parse HTML and find title
        const root = parse(html);
        const title = root.querySelector('title');
        
        // End timing
        const endTime = performance.now();
        
        // Calculate total time
        const timeToTitle = endTime - startTime;
        
        return {
            success: true,
            url: url,
            title: title ? title.text : 'No title found',
            timeToTitle: timeToTitle.toFixed(2),
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Example usage
async function runTest() {
    const url = process.argv[2] || 'https://example.com';
    console.log('Testing Time to Title for:', url);
    
    const result = await measureTimeToTitle(url);
    console.log(JSON.stringify(result, null, 2));
}

runTest();