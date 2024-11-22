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


export default defineConfig({
    plugins: [react()],
    server: {
        host: '192.168.68.110',
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://192.168.68.110:5000',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, '')  // Add this if your backend doesn't expect /api prefix
            },
        },
    },
});