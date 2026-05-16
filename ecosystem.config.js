module.exports = {
    apps: [
        {
            name: "pjr-api-python",
            script: "/home/admin/pjr-venv/bin/gunicorn",
            args: "app:app -b 0.0.0.0:5002 --workers 1 --threads 4 --timeout 120",
            cwd: "/media/admin/MAXELL8GB/pjr-python",
            interpreter: "none",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "production",
                PORT: 5002,
                PATH: "/home/admin/pjr-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                VIRTUAL_ENV: "/home/admin/pjr-venv"
            },
        },
    ],
};
