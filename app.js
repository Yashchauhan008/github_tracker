import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';  // Import dotenv

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Replace with your GitHub token

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Helper function to calculate streaks
const calculateStreak = (events) => {
  if (!events || events.length === 0) return 0;

  // Get the dates of the contributions (exclude the last day's data)
  const dates = events.map(event => new Date(event.created_at).toISOString().split('T')[0]);

  // Remove duplicates
  const uniqueDates = [...new Set(dates)];

  // Sort the dates in ascending order
  uniqueDates.sort((a, b) => new Date(a) - new Date(b));

  // Calculate the streak, excluding the last day (index of the streak is length - 2)
  let streak = 0;

  // Iterate through dates, excluding the last one
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const prevDate = new Date(uniqueDates[i]);
    const currentDate = new Date(uniqueDates[i + 1]);

    // Check if the dates are consecutive (1 day apart)
    if ((currentDate - prevDate) === 86400000) {
      streak++;
    }
  }

  return streak;
};

// Serve the static HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle the POST request for fetching follower and following lists
app.post('/get-followers-following', async (req, res) => {
  const username = req.body.username;

  // Define URLs to fetch followers and following data
  const followersUrl = `https://api.github.com/users/${username}/followers`;
  const followingUrl = `https://api.github.com/users/${username}/following`;

  try {
    // Fetch the user data (for calculating their own streak)
    const userEventsUrl = `https://api.github.com/users/${username}/events/public`;
    const userEventsResponse = await fetch(userEventsUrl, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!userEventsResponse.ok) {
      throw new Error(`Failed to fetch user events. Status: ${userEventsResponse.status}`);
    }

    const userEventsData = await userEventsResponse.json();
    const userStreak = calculateStreak(userEventsData);

    // Fetch followers
    const followersResponse = await fetch(followersUrl, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!followersResponse.ok) {
      throw new Error(`Failed to fetch followers. Status: ${followersResponse.status}`);
    }

    const followersData = await followersResponse.json();

    // Fetch following
    const followingResponse = await fetch(followingUrl, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!followingResponse.ok) {
      throw new Error(`Failed to fetch following. Status: ${followingResponse.status}`);
    }

    const followingData = await followingResponse.json();

    // Handle if followers or following are empty or not returned as arrays
    if (!Array.isArray(followersData) || !Array.isArray(followingData)) {
      return res.json({
        error: `Unable to fetch followers/following data for user: ${username}`,
      });
    }

    // Function to fetch the streak of a user
    const fetchUserStreak = async (user) => {
      const eventsUrl = `https://api.github.com/users/${user.login}/events/public`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      if (!eventsResponse.ok) {
        return { username: user.login, streak: 0 };
      }
      const eventsData = await eventsResponse.json();
      const streak = calculateStreak(eventsData);
      return { username: user.login, streak };
    };

    // Fetch streaks for followers and following
    const followersWithStreak = await Promise.all(followersData.map(fetchUserStreak));
    const followingWithStreak = await Promise.all(followingData.map(fetchUserStreak));

    // Get the count of followers and following
    const followersCount = followersData.length;
    const followingCount = followingData.length;

    // Send back the JSON response with the follower and following lists and their streaks
    return res.json({
      username: username,
      userStreak: userStreak,
      followersCount: followersCount,
      followingCount: followingCount,
      followersList: followersWithStreak,
      followingList: followingWithStreak,
    });
  } catch (error) {
    // Log error details for debugging
    console.error(error.message);
    return res.json({
      error: `Failed to fetch data for user: ${username}. Error: ${error.message}`,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
