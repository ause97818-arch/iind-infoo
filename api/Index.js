const axios = require('axios');

// Vercel-er Environment Variables theke data read kora
const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO;
const owner = process.env.GH_OWNER;
const branch = process.env.GH_BRANCH || 'main';
const filePath = 'database.json'; // Repository-te eii naam-e file create hobe

module.exports = async (req, res) => {
    // CORS Headers setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GitHub API requests-er jonno headers configuration
    const githubHeaders = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Database-Logger'
    };

    // --- ROUTE 1: Total saved database fetch korar jonno (/api?fetch=all) ---
    if (req.query.fetch === 'all') {
        try {
            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
            const ghRes = await axios.get(ghUrl, { headers: githubHeaders });
            const currentContent = Buffer.from(ghRes.data.content, 'base64').toString('utf-8');
            return res.status(200).json(JSON.parse(currentContent));
        } catch (err) {
            // Jodi database.json file ekhono na create hoye thake, khali array return korbe
            if (err.response && err.response.status === 404) {
                return res.status(200).json({ message: "Database is empty. No records found yet.", database: [] });
            }
            return res.status(500).json({ status: "error", message: "Failed to fetch data from GitHub", details: err.message });
        }
    }

    // --- ROUTE 2: Main Image Proxy query handle kora (?img=dog ba ?text=dog) ---
    const textParam = req.query.img || req.query.text;

    if (!textParam) {
        return res.status(400).json({ 
            status: "error", 
            message: "Parameter missing! Use /api?img=yourtext to generate image, or /api?fetch=all to see saved database history." 
        });
    }

    try {
        // 1. Target API theke data fetch kora
        const targetUrl = `https://jerrycoder.oggyapi.workers.dev/ephoto/1917style?text=${encodeURIComponent(textParam)}`;
        const response = await axios.get(targetUrl);
        const data = response.data;

        // 2. Response success hole GitHub database file list update kora
        if (data && data.status === "success") {
            const logEntry = {
                status: data.status,
                image: data.image,
                Creator: data.Creator || "JerryCoder",
                telegram: data.telegram || "Oggy_workshop",
                timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
            };

            let currentDatabase = [];
            let sha = null;

            // GitHub repo theke purono database.json file search kora
            try {
                const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
                const ghRes = await axios.get(ghUrl, { headers: githubHeaders });
                sha = ghRes.data.sha; // Update korar jonno SHA mandatory
                const fileContent = Buffer.from(ghRes.data.content, 'base64').toString('utf-8');
                currentDatabase = JSON.parse(fileContent);
            } catch (e) {
                // File first time generate hole catch error skip hobe
            }

            // Naya entry array-r top-te push kora
            currentDatabase.unshift(logEntry);

            // Updated data-ke base64 format-e convert kora GitHub API-r jonno
            const updateUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
            const updatedContentBase64 = Buffer.from(JSON.stringify(currentDatabase, null, 2)).toString('base64');

            const commitData = {
                message: `chore: auto log new api entry for '${textParam}' [skip ci]`,
                content: updatedContentBase64,
                branch: branch
            };
            if (sha) commitData.sha = sha;

            // GitHub-e file automatic commit / push kora
            await axios.put(updateUrl, commitData, { headers: githubHeaders });
        }

        // 3. User-ke main data response pathানো
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ 
            status: "error", 
            message: "Internal operational failure",
            details: error.response ? error.response.data : error.message 
        });
    }
};

