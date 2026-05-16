module.exports = {
    apps: [
        {
            name: "pjr-api-python",
            script: "/home/admin/pjr-venv/bin/gunicorn",
            args: "app:app -b 0.0.0.0:5002 --workers 1 --threads 4 --timeout 120",
            interpreter: "none",
            instances: 1, // Single instance to prevent duplicate background sync threads
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "production",
                PORT: 5002,
            },
        },
    ],
};
