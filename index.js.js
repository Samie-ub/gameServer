const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Define a Mongoose schema for your data
const dataSchema = new mongoose.Schema({
    licenseKey: String,
    hwid: String
});

// Define a Mongoose model based on the schema
const Data = mongoose.model('Data', dataSchema);

// POST endpoint to store license key and HWID
app.post('/store', async (req, res) => {
    const { licenseKey, hwid } = req.body;

    if (!licenseKey || !hwid) {
        return res.status(400).json({ error: 'Both licenseKey and hwid are required' });
    }

    try {
        // Create a new document and save it to the database
        const newData = new Data({ licenseKey, hwid });
        await newData.save();
        return res.status(200).json({ message: 'Data stored successfully' });
    } catch (err) {
        console.error('Error storing data:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET endpoint to retrieve stored data
app.get('/data', async (req, res) => {
    try {
        // Retrieve all documents from the database
        const allData = await Data.find();

        // Create a map to store data grouped by license key
        const groupedData = {};
        allData.forEach(record => {
            if (!groupedData[record.licenseKey]) {
                groupedData[record.licenseKey] = [record];
            } else {
                groupedData[record.licenseKey].push(record);
            }
        });

        // Check if there are multiple records with different HWIDs for the same license key
        const conflictingRecords = [];
        Object.values(groupedData).forEach(records => {
            const uniqueHWIDs = new Set(records.map(record => record.hwid));
            if (uniqueHWIDs.size > 1) {
                conflictingRecords.push({ licenseKey: records[0].licenseKey, records });
            }
        });

        if (conflictingRecords.length > 0) {
            return res.status(409).json({ error: 'Multiple HWIDs found for the same license key', conflictingRecords });
        }

        // No conflicting records found
        return res.status(200).json(allData);
    } catch (err) {
        console.error('Error retrieving data:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/:licenseKey', async (req, res) => {
    const licenseKey = req.params.licenseKey;

    try {
        // Retrieve data from the database based on the provided license key
        const data = await Data.find({ licenseKey });

        if (data.length === 0) {
            // No data found for the given licenseKey
            return res.status(404).json({ error: 'Data not found for the given license key' });
        }

        // Check if there are multiple records with the same licenseKey but different HWIDs
        const uniqueHWIDs = new Set(data.map(record => record.hwid));
        if (uniqueHWIDs.size > 1) {
            // Multiple HWIDs found for the same licenseKey
            const conflictingRecords = data.filter(record => uniqueHWIDs.has(record.hwid));
            return res.status(409).json({ error: 'Multiple HWIDs found for the same license key', conflictingRecords });
        }

        // Only one HWID found for the given licenseKey
        return res.status(200).json({ message: 'Data retrieved successfully', data });
    } catch (err) {
        console.error('Error retrieving data:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
