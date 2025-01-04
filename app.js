const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to fetch GitHub data
app.post('/api/github', async (req, res) => {
  const { username, token } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token are required.' });
  }

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    };

    // Fetch followers
    const followersUrl = `https://api.github.com/users/${username}/followers`;
    const followersResponse = await axios.get(followersUrl, { headers });
    const followers = followersResponse.data;

    // Fetch following
    const followingUrl = `https://api.github.com/users/${username}/following`;
    const followingResponse = await axios.get(followingUrl, { headers });
    const following = followingResponse.data;

    // Helper function to fetch repos and commits for a user
    const fetchUserData = async (user) => {
      const reposUrl = `https://api.github.com/users/${user.login}/repos`;
      const reposResponse = await axios.get(reposUrl, { headers });
      const repos = reposResponse.data;

      const userData = {
        name: user.login,
        repos: [],
      };

      for (const repo of repos) {
        const repoName = repo.name;

        // Skip repositories with no commits
        if (repo.size === 0) {
          userData.repos.push({
            name: repoName,
            commitCount: 0,
          });
          continue;
        }

        const commitsUrl = `https://api.github.com/repos/${user.login}/${repoName}/commits`;
        try {
          const commitsResponse = await axios.get(commitsUrl, { headers });
          const commits = commitsResponse.data;
          userData.repos.push({
            name: repoName,
            commitCount: commits.length,
          });
        } catch (err) {
          console.log(`Error fetching commits for ${repoName}:`, err.message);
          userData.repos.push({
            name: repoName,
            commitCount: 'Error fetching commits',
          });
        }
      }

      return userData;
    };

    // Fetch data for followers and following
    const followersData = await Promise.all(followers.map(fetchUserData));
    const followingData = await Promise.all(following.map(fetchUserData));

    res.json({ followers: followersData, following: followingData });
  } catch (err) {
    console.error('Error fetching data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
