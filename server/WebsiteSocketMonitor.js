import WebSocket from 'ws';
import puppeteer from 'puppeteer';
import net from 'net';
import url from 'url';
import dns from 'dns';
import { promisify } from 'util';

class WebsiteSocketMonitor {
    constructor(targetUrl) {
        this.targetUrl = targetUrl;
        this.parsedUrl = new URL(targetUrl);
        this.hostname = this.parsedUrl.hostname;
    }

    async analyzeConnections() {
        const results = {
            url: this.targetUrl,
            timestamp: new Date().toISOString(),
            connections: [],
            totalConnections: 0
        };

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'shell',
                args: ['--no-sandbox']
            });

            const page = await browser.newPage();

            // Enable necessary CDP domains
            const client = await page.target().createCDPSession();
            await client.send('Network.enable');

            // Store active connections
            const connections = new Map();

            // Listen for WebSocket handshake requests
            client.on('Network.webSocketWillSendHandshakeRequest', async (params) => {
                const { requestId, request } = params;
                connections.set(requestId, {
                    id: requestId,
                    url: request.url,
                    headers: request.headers,
                    timestamp: new Date().toISOString(),
                    status: 'connecting'
                });
            });

            // Track successful connections
            client.on('Network.webSocketHandshakeResponseReceived', async (params) => {
                const { requestId, response } = params;
                if (connections.has(requestId)) {
                    const connection = connections.get(requestId);
                    connection.status = 'connected';
                    connection.statusCode = response.status;
                    connection.responseHeaders = response.headers;
                }
            });

            // Track messages
            client.on('Network.webSocketFrameSent', async (params) => {
                const { requestId, timestamp, response } = params;
                if (connections.has(requestId)) {
                    const connection = connections.get(requestId);
                    connection.messagesSent = (connection.messagesSent || 0) + 1;
                    connection.lastActive = new Date().toISOString();
                }
            });

            client.on('Network.webSocketFrameReceived', async (params) => {
                const { requestId, timestamp, response } = params;
                if (connections.has(requestId)) {
                    const connection = connections.get(requestId);
                    connection.messagesReceived = (connection.messagesReceived || 0) + 1;
                    connection.lastActive = new Date().toISOString();
                }
            });

            // Track connection closures
            client.on('Network.webSocketClosed', async (params) => {
                const { requestId } = params;
                if (connections.has(requestId)) {
                    const connection = connections.get(requestId);
                    connection.status = 'closed';
                    connection.closedAt = new Date().toISOString();
                }
            });

            // Inject script to intercept WebSocket creation
            await page.evaluateOnNewDocument(() => {
                const wsConnections = new Set();
                
                // Override WebSocket constructor
                const OriginalWebSocket = window.WebSocket;
                window.WebSocket = function(...args) {
                    const ws = new OriginalWebSocket(...args);
                    
                    // Add connection details to window object for puppeteer to access
                    const connectionDetails = {
                        url: args[0],
                        protocol: ws.protocol,
                        created: new Date().toISOString(),
                        state: 'connecting'
                    };
                    
                    wsConnections.add(connectionDetails);
                    
                    ws.addEventListener('open', () => {
                        connectionDetails.state = 'connected';
                        connectionDetails.protocol = ws.protocol;
                    });
                    
                    ws.addEventListener('close', () => {
                        connectionDetails.state = 'closed';
                    });
                    
                    return ws;
                };
                
                // Make connections accessible
                window.__WS_CONNECTIONS__ = wsConnections;
            });

            // Navigate to the page and wait for network idle
            await page.goto(this.targetUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait a bit to allow connections to establish
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get connections from page context
            const pageConnections = await page.evaluate(() => {
                return Array.from(window.__WS_CONNECTIONS__ || []).map(conn => ({
                    ...conn,
                    readyState: conn.state
                }));
            });

            // Combine CDP and page-level connection data
            const allConnections = new Map([...connections]);
            pageConnections.forEach(conn => {
                if (!Array.from(allConnections.values()).some(existing => existing.url === conn.url)) {
                    allConnections.set(`page-${Math.random()}`, {
                        ...conn,
                        status: conn.state,
                        timestamp: conn.created
                    });
                }
            });

            // Format results
            results.connections = Array.from(allConnections.values())
                .filter(conn => conn.status === 'connected')
                .map(conn => ({
                    url: conn.url,
                    protocol: conn.responseHeaders?.['Sec-WebSocket-Protocol'] || 'unknown',
                    status: conn.status,
                    messagesSent: conn.messagesSent || 0,
                    messagesReceived: conn.messagesReceived || 0,
                    established: conn.timestamp,
                    lastActive: conn.lastActive || conn.timestamp
                }));

            results.totalConnections = results.connections.length;

            // Check for Socket.io specifically
            const socketIoConnections = await page.evaluate(() => {
                if (window.io && window.io.sockets) {
                    return Object.keys(window.io.sockets).map(socketId => ({
                        type: 'socket.io',
                        id: socketId,
                        namespace: window.io.sockets[socketId].nsp
                    }));
                }
                return [];
            });

            results.connections.push(...socketIoConnections);

        } catch (error) {
            results.error = error.message;
        } finally {
            if (browser) {
                await browser.close();
            }
        }

        return results;
    }

    async startMonitoring(interval = 10000) { // Check every 10 seconds
        console.log(`Starting socket monitoring for ${this.targetUrl}`);
        
        const monitoring = setInterval(async () => {
            const results = await this.analyzeConnections();
            console.log('\n=== Socket Connection Report ===');
            console.log(`Time: ${results.timestamp}`);
            console.log(`Total Active Connections: ${results.totalConnections}`);
            
            if (results.connections.length > 0) {
                console.log('\nActive Connections:');
                results.connections.forEach((conn, index) => {
                    console.log(`\n${index + 1}. Connection Details:`);
                    console.log(`   URL: ${conn.url}`);
                    console.log(`   Protocol: ${conn.protocol}`);
                    console.log(`   Status: ${conn.status}`);
                    console.log(`   Messages Sent: ${conn.messagesSent}`);
                    console.log(`   Messages Received: ${conn.messagesReceived}`);
                    console.log(`   Established: ${conn.established}`);
                    console.log(`   Last Active: ${conn.lastActive}`);
                });
            }
            
            if (results.error) {
                console.error('Error:', results.error);
            }
        }, interval);

        return monitoring;
    }
}

export default WebsiteSocketMonitor;