require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour
const PORT = process.env.PORT || 3000;
const GITHUB_API_BASE = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Function to get following list
async function getFollowing(username) {
    const cachedData = cache.get(username);
    if (cachedData) {
        console.log('Serving from cache');
        return cachedData;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const url = `${GITHUB_API_BASE}/users/${username}/following`;

    try {
        const response = await axios.get(url, { headers });
        const followingList = response.data.map(user => user.login);
        cache.set(username, followingList); // Cache the response
        return followingList;
    } catch (error) {
        if (error.response) {
            if (error.response.status === 403) {
                throw new Error('API rate limit exceeded. Please try again later.');
            } else if (error.response.status === 404) {
                throw new Error('User not found');
            }
        }
        throw new Error('Failed to fetch following list');
    }
}

// Function to mock contribution streaks
async function getContributionStreak(username) {
    return Math.floor(Math.random() * 100); // Mocked streak data
}

// Function to generate chart
async function generateChart(data) {
    const width = 800;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const config = {
        type: 'bar',
        data: {
            labels: data.map(d => d.username),
            datasets: [
                {
                    label: 'Contribution Streak (Days)',
                    data: data.map(d => d.streak),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'GitHub Contribution Streaks' },
            },
        },
    };

    return await chartJSNodeCanvas.renderToBuffer(config);
}

// Route to handle form submission and display chart
app.post('/streak', async (req, res) => {
    const { username } = req.body;

    try {
        const following = await getFollowing(username);

        if (following.length === 0) {
            return res.status(404).send('<h1>No following users found for this username</h1>');
        }

        const streakData = await Promise.all(
            following.map(async (user) => {
                const streak = await getContributionStreak(user);
                return { username: user, streak };
            })
        );

        const chartBuffer = await generateChart(streakData);

        res.set('Content-Type', 'image/png');
        res.send(chartBuffer);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send(`<h1>Error: ${error.message}</h1>`);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

