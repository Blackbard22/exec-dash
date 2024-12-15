import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// export default defineConfig({
//     plugins: [react()],
//     server: {
//         proxy: {
//             '/api': {
//                 // target: 'http://localhost:5000',
//                 // target: 'http://localhost:5000',
//                 target: '192.168.68.110:3000',

//                 changeOrigin: true,
//             },
//         },
//     },
// });

// export default defineConfig({
//     plugins: [react()],
//     server: {
//         host: '192.168.68.110',
//         port: 3000,
//         proxy: {
//             '/api': {
//                 target: 'http://192.168.68.110:5000',
//                 changeOrigin: true,
//             },
//         },
//     },
// });

import { networkInterfaces } from 'os';

// Get local IP address
const getLocalIP = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost'; // Fallback to localhost if no other IP found
};

const localIP = getLocalIP();

export default defineConfig({
    plugins: [react()],
    server: {
        host: localIP,
        port: 3000,
        proxy: {
            '/api': {
                target: `http://${localIP}:5000`,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
        },
    },
});