const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const FALLBACK_FILE = path.join(__dirname, 'db-fallback.json');
let isFallback = false;

// Attempt to connect to MongoDB
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/url_shortener';
  try {
    console.log('⚡ Attempting to connect to MongoDB...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000, // Timeout after 2 seconds
    });
    console.log('✅ Connected to MongoDB successfully.');
  } catch (error) {
    console.warn('❌ MongoDB connection failed:', error.message);
    console.warn('⚠️  Switching to high-fidelity JSON File Database fallback...');
    isFallback = true;
    initializeFallbackFile();
  }
}

// Fallback JSON operations helper
function initializeFallbackFile() {
  if (!fs.existsSync(FALLBACK_FILE)) {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readFallbackData() {
  try {
    initializeFallbackFile();
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading fallback DB:', e);
    return [];
  }
}

function writeFallbackData(data) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing fallback DB:', e);
  }
}

// Defining URL schema structure
const UrlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true },
  clicks: { type: Number, default: 0 },
  analytics: [
    {
      timestamp: { type: Date, default: Date.now },
      ip: String,
      userAgent: String,
      browser: String,
      os: String,
      referrer: String,
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const MongooseUrlModel = mongoose.model('Url', UrlSchema);

// Custom User Agent parser for JSON Fallback
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  
  let browser = 'Other';
  let os = 'Other';

  // Basic Browser Detection
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  // Basic OS Detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

// Unified URL Database Interface API
const UrlDB = {
  async find() {
    if (!isFallback) {
      return await MongooseUrlModel.find().sort({ createdAt: -1 });
    }
    const data = readFallbackData();
    // Sort descending by createdAt
    return data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findOne(query) {
    if (!isFallback) {
      return await MongooseUrlModel.findOne(query);
    }
    const data = readFallbackData();
    const key = Object.keys(query)[0];
    const val = query[key];
    const found = data.find(item => item[key] === val);
    return found || null;
  },

  async create(doc) {
    if (!isFallback) {
      return await MongooseUrlModel.create(doc);
    }
    const data = readFallbackData();
    const newDoc = {
      _id: Math.random().toString(36).substring(2, 9),
      clicks: 0,
      analytics: [],
      createdAt: new Date().toISOString(),
      ...doc
    };
    data.push(newDoc);
    writeFallbackData(data);
    return newDoc;
  },

  async updateOne(query, update) {
    if (!isFallback) {
      return await MongooseUrlModel.updateOne(query, update);
    }
    const data = readFallbackData();
    const key = Object.keys(query)[0];
    const val = query[key];
    const index = data.findIndex(item => item[key] === val);
    if (index !== -1) {
      // Basic implementation of updates (e.g. $push, $inc, etc.)
      const item = data[index];
      if (update.$inc) {
        for (const incKey in update.$inc) {
          item[incKey] = (item[incKey] || 0) + update.$inc[incKey];
        }
      }
      if (update.$push) {
        for (const pushKey in update.$push) {
          if (!item[pushKey]) item[pushKey] = [];
          item[pushKey].push({
            _id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            ...update.$push[pushKey]
          });
        }
      }
      data[index] = item;
      writeFallbackData(data);
      return { nModified: 1 };
    }
    return { nModified: 0 };
  },

  async findOneAndUpdate(query, update, options = {}) {
    // High level wrapper for server code
    if (!isFallback) {
      return await MongooseUrlModel.findOneAndUpdate(query, update, { new: true, ...options });
    }
    await this.updateOne(query, update);
    return await this.findOne(query);
  },

  async deleteOne(query) {
    if (!isFallback) {
      return await MongooseUrlModel.deleteOne(query);
    }
    let data = readFallbackData();
    const key = Object.keys(query)[0];
    const val = query[key];
    const initialLen = data.length;
    data = data.filter(item => item[key] !== val);
    writeFallbackData(data);
    return { deletedCount: initialLen - data.length };
  },

  async countDocuments(query = {}) {
    if (!isFallback) {
      return await MongooseUrlModel.countDocuments(query);
    }
    const data = readFallbackData();
    if (Object.keys(query).length === 0) return data.length;
    const key = Object.keys(query)[0];
    const val = query[key];
    return data.filter(item => item[key] === val).length;
  }
};

module.exports = {
  connectDB,
  Url: UrlDB,
  isFallback: () => isFallback,
  parseUserAgent
};
