require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database (auto-fallback inside db.js)
db.connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple URL generator
function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// URL Validation Regex
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * API Routes
 */

// 1. Create short URL
app.post('/api/shorten', async (req, res) => {
  const { originalUrl, customAlias } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: 'Original URL is required.' });
  }

  if (!isValidUrl(originalUrl)) {
    return res.status(400).json({ error: 'Invalid URL format. Please include http:// or https://' });
  }

  try {
    let shortCode = customAlias ? customAlias.trim() : '';

    if (shortCode) {
      // Validate custom alias format
      if (!/^[a-zA-Z0-9-_]+$/.test(shortCode)) {
        return res.status(400).json({ error: 'Custom alias can only contain alphanumeric characters, hyphens, and underscores.' });
      }

      // Check if alias is already taken
      const existing = await db.Url.findOne({ shortCode });
      if (existing) {
        return res.status(400).json({ error: 'Custom alias is already taken. Please try another.' });
      }
    } else {
      // Generate a unique short code
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        shortCode = generateShortCode();
        const existing = await db.Url.findOne({ shortCode });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
      }
    }

    const newUrl = await db.Url.create({
      originalUrl,
      shortCode,
    });

    res.status(201).json({
      message: 'URL shortened successfully!',
      data: newUrl,
      isFallback: db.isFallback()
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error. Failed to shorten URL.' });
  }
});

// 2. Get all shortened URLs
app.get('/api/urls', async (req, res) => {
  try {
    const urls = await db.Url.find();
    res.json({
      urls,
      isFallback: db.isFallback()
    });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ error: 'Server error. Failed to fetch URLs.' });
  }
});

// 3. Delete shortened URL
app.delete('/api/urls/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await db.Url.deleteOne({ shortCode: code });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Short URL not found.' });
    }
    res.json({ message: 'Short URL deleted successfully!' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ error: 'Server error. Failed to delete URL.' });
  }
});

// 4. Get deep analytics for a short URL
app.get('/api/urls/:code/analytics', async (req, res) => {
  const { code } = req.params;
  try {
    const urlRecord = await db.Url.findOne({ shortCode: code });
    if (!urlRecord) {
      return res.status(404).json({ error: 'Short URL not found.' });
    }

    const analytics = urlRecord.analytics || [];
    
    // Process analytics breakdown
    const browsers = {};
    const os = {};
    const referrers = {};
    const clicksOverTime = {};

    analytics.forEach(item => {
      // Browsers
      const browser = item.browser || 'Other';
      browsers[browser] = (browsers[browser] || 0) + 1;

      // OS
      const osName = item.os || 'Other';
      os[osName] = (os[osName] || 0) + 1;

      // Referrers
      let referrerHost = 'Direct / Email';
      if (item.referrer && item.referrer !== 'Direct') {
        try {
          const refUrl = new URL(item.referrer);
          referrerHost = refUrl.hostname || item.referrer;
        } catch (_) {
          referrerHost = item.referrer;
        }
      }
      referrers[referrerHost] = (referrers[referrerHost] || 0) + 1;

      // Clicks Over Time (format: YYYY-MM-DD)
      const dateStr = new Date(item.timestamp).toISOString().split('T')[0];
      clicksOverTime[dateStr] = (clicksOverTime[dateStr] || 0) + 1;
    });

    res.json({
      clicks: urlRecord.clicks,
      createdAt: urlRecord.createdAt,
      originalUrl: urlRecord.originalUrl,
      shortCode: urlRecord.shortCode,
      breakdowns: {
        browsers,
        os,
        referrers,
        clicksOverTime: Object.keys(clicksOverTime)
          .sort()
          .reduce((acc, key) => {
            acc[key] = clicksOverTime[key];
            return acc;
          }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Server error. Failed to load analytics.' });
  }
});

// 5. Redirection endpoint
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  // Ignore requests for favicon
  if (code === 'favicon.ico') {
    return res.status(204).end();
  }

  try {
    const urlRecord = await db.Url.findOne({ shortCode: code });
    if (!urlRecord) {
      // Redirect to homepage with an error toast flag
      return res.redirect(`/?error=not_found&code=${code}`);
    }

    // Capture visitor analytics details
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || 'Direct';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown';
    
    const uaInfo = db.parseUserAgent(userAgent);

    // Asynchronously record the click and analytics data
    db.Url.updateOne(
      { shortCode: code },
      {
        $inc: { clicks: 1 },
        $push: {
          analytics: {
            ip,
            userAgent,
            browser: uaInfo.browser,
            os: uaInfo.os,
            referrer,
            timestamp: new Date()
          }
        }
      }
    ).catch(err => console.error('Failed to log analytics:', err));

    // Redirect user to the original destination URL
    res.redirect(urlRecord.originalUrl);
  } catch (error) {
    console.error('Redirection error:', error);
    res.redirect('/?error=server_error');
  }
});

// Fallback to static root file for anything else
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Day 8 URL Shortener is active on port ${PORT}!`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
});
