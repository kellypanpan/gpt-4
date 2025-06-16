const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { writeFile } = require("fs/promises");
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Replicate client
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve your HTML file from public directory

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and HEIC are allowed.'));
        }
    }
});

// Store job status in memory (use Redis in production)
const jobStorage = new Map();

// Flux Model Configuration
const FLUX_MODELS = {
    kontext: "black-forest-labs/flux-kontext-pro",
    dev: "black-forest-labs/flux-dev", 
    schnell: "black-forest-labs/flux-schnell",
    pro: "black-forest-labs/flux-pro"
};

// Upload image endpoint
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            imageUrl: imageUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Process image with Flux Kontext using Replicate SDK
async function processWithFluxKontext(imageUrl, prompt, options = {}) {
    try {
        console.log('Processing with Flux Kontext:', { imageUrl, prompt, options });
        
        const input = {
            image_url: imageUrl,
            prompt: prompt,
            guidance_scale: options.guidanceScale || 3.5,
            num_images: 1,
            output_format: 'jpeg',
            aspect_ratio: options.aspectRatio || '1:1',
            seed: options.seed || Math.floor(Math.random() * 1000000)
        };

        // Use Replicate SDK for async prediction
        const prediction = await replicate.predictions.create({
            version: await getModelVersion(FLUX_MODELS.kontext),
            input: input
        });

        return {
            jobId: prediction.id,
            status: prediction.status,
            urls: prediction.urls
        };
    } catch (error) {
        console.error('Flux Kontext processing error:', error);
        throw new Error(`Flux Kontext processing failed: ${error.message}`);
    }
}

// Process with Flux Dev model (for general image generation)
async function processWithFluxDev(prompt, options = {}) {
    try {
        console.log('Processing with Flux Dev:', { prompt, options });
        
        const input = {
            prompt: prompt,
            guidance: options.guidance || 3.5,
            num_outputs: 1,
            aspect_ratio: options.aspectRatio || "1:1",
            output_format: "webp",
            output_quality: 90,
            seed: options.seed
        };

        // Use synchronous run for simpler cases
        const output = await replicate.run(FLUX_MODELS.dev, { input });
        
        // Save the generated image
        const filename = `generated_${Date.now()}_${uuidv4()}.webp`;
        const filepath = path.join('uploads', filename);
        
        // Download and save the image
        const response = await axios.get(output[0], { responseType: 'arraybuffer' });
        await writeFile(filepath, response.data);
        
        const imageUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${filename}`;
        
        return {
            outputUrl: imageUrl,
            status: 'completed'
        };
    } catch (error) {
        console.error('Flux Dev processing error:', error);
        throw new Error(`Flux Dev processing failed: ${error.message}`);
    }
}

// Get model version (caches the version for performance)
const modelVersionCache = new Map();
async function getModelVersion(modelName) {
    if (modelVersionCache.has(modelName)) {
        return modelVersionCache.get(modelName);
    }
    
    try {
        const model = await replicate.models.get(modelName);
        const version = model.latest_version.id;
        modelVersionCache.set(modelName, version);
        return version;
    } catch (error) {
        console.error('Error getting model version:', error);
        // Fallback to known versions
        const fallbackVersions = {
            "black-forest-labs/flux-kontext-pro": "0f1178f5a27e9aa2d2d39c8a43c110f7fa7cbf64062ff04a04cd40899e546065",
            "black-forest-labs/flux-dev": "black-forest-labs/flux-dev:6ac01f1b64e413e6b65a7ac79c74c22b11aeb6e96067c8b725e1d3fac967a7b7"
        };
        return fallbackVersions[modelName] || modelName;
    }
}

// Main Flux processing endpoint
app.post('/api/flux-kontext', async (req, res) => {
    try {
        const { image_url, prompt, guidance_scale, aspect_ratio, seed, model_type } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        const options = {
            guidanceScale: guidance_scale,
            guidance: guidance_scale, // For flux-dev compatibility
            aspectRatio: aspect_ratio,
            seed: seed
        };

        let result;
        
        // Determine which model to use
        if (image_url && model_type !== 'generation') {
            // Use Flux Kontext for image editing
            result = await processWithFluxKontext(image_url, prompt, options);
        } else {
            // Use Flux Dev for image generation
            result = await processWithFluxDev(prompt, options);
        }

        // Store job information for async processing
        if (result.jobId) {
            jobStorage.set(result.jobId, {
                status: result.status || 'processing',
                createdAt: new Date(),
                prompt: prompt,
                imageUrl: image_url,
                provider: 'replicate',
                modelType: image_url ? 'kontext' : 'dev'
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Flux processing error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to process with Flux'
        });
    }
});

// Image generation endpoint (without input image)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, guidance, aspect_ratio, seed } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        const options = {
            guidance: guidance || 3.5,
            aspectRatio: aspect_ratio || "1:1",
            seed: seed
        };

        const result = await processWithFluxDev(prompt, options);
        res.json(result);

    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to generate image'
        });
    }
});

// Check job status endpoint (enhanced)
app.get('/api/job-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobInfo = jobStorage.get(jobId);

        if (!jobInfo) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check status with Replicate
        try {
            const prediction = await replicate.predictions.get(jobId);
            
            let outputUrl = null;
            if (prediction.status === 'succeeded' && prediction.output) {
                if (Array.isArray(prediction.output)) {
                    outputUrl = prediction.output[0];
                } else {
                    outputUrl = prediction.output;
                }
            }

            // Update job status
            jobStorage.set(jobId, { ...jobInfo, status: prediction.status });

            // Clean up completed jobs
            if (prediction.status === 'succeeded' || prediction.status === 'failed') {
                setTimeout(() => jobStorage.delete(jobId), 60000);
            }

            res.json({
                status: prediction.status,
                outputUrl,
                jobId,
                logs: prediction.logs,
                error: prediction.error
            });

        } catch (apiError) {
            console.error('Error checking prediction status:', apiError);
            res.status(500).json({ error: 'Failed to check job status' });
        }

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check job status' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeJobs: jobStorage.size,
        models: Object.keys(FLUX_MODELS),
        replicateConnected: !!process.env.REPLICATE_API_TOKEN
    });
});

// List available models endpoint
app.get('/api/models', (req, res) => {
    res.json({
        available_models: FLUX_MODELS,
        recommended: {
            image_editing: FLUX_MODELS.kontext,
            image_generation: FLUX_MODELS.dev,
            fast_generation: FLUX_MODELS.schnell
        }
    });
});

// Test endpoint for quick verification
app.post('/api/test-generation', async (req, res) => {
    try {
        const testPrompt = req.body.prompt || "a beautiful sunset over mountains, photorealistic";
        
        console.log('Running test generation with prompt:', testPrompt);
        
        const result = await processWithFluxDev(testPrompt, {
            guidance: 3.5,
            aspectRatio: "1:1"
        });
        
        res.json({
            success: true,
            message: "Test generation completed successfully",
            result: result
        });
        
    } catch (error) {
        console.error('Test generation error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            message: "Test generation failed"
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File too large. Maximum size is 10MB.' 
            });
        }
        return res.status(400).json({ 
            error: `Upload error: ${error.message}` 
        });
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        available_endpoints: [
            'POST /api/upload-image',
            'POST /api/flux-kontext',
            'POST /api/generate-image',
            'GET /api/job-status/:jobId',
            'GET /api/models',
            'GET /health'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Flux Kontext API Server running on port ${PORT}`);
    console.log(`📝 Environment Configuration:`);
    console.log(`   - REPLICATE_API_TOKEN: ${process.env.REPLICATE_API_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`   - Available Models: ${Object.keys(FLUX_MODELS).join(', ')}`);
    console.log(`📂 Server Features:`);
    console.log(`   - Image Upload & Processing`);
    console.log(`   - Flux Kontext (Image Editing)`);
    console.log(`   - Flux Dev (Image Generation)`);
    console.log(`   - Async Job Processing`);
    console.log(`   - Health Monitoring`);
    console.log(`🌐 Access your app at: http://localhost:${PORT}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app; 