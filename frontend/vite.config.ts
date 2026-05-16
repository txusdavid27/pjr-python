import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
            "/photos": {
                target: "http://localhost:3000",
                changeOrigin: true,
                secure: false,
            }
        },
    },
    build: {
        emptyOutDir: true,
    },
})
