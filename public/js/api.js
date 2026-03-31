// API Wrapper
const API = {
    async login(username, password, role) {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        return res.json();
    },

    async logout() {
        const res = await fetch('/auth/logout', { method: 'POST' });
        return res.json();
    },

    async checkSession() {
        const res = await fetch('/auth/session');
        return res.json();
    },

    async get(endpoint) {
        const res = await fetch(`/api/${endpoint}`);
        if (!res.ok) throw new Error('API request failed');
        return res.json();
    }
};
