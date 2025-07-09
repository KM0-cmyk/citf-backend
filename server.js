const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup for project images (max 5 files)
const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const uploadProjects = multer({ storage: projectStorage });

// Multer setup for carousel images (single file only)
const carouselStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const uploadCarousel = multer({ storage: carouselStorage });

// Load projects from file
const projectsDbPath = path.join(__dirname, 'projects.json');
let projects = fs.existsSync(projectsDbPath)
  ? JSON.parse(fs.readFileSync(projectsDbPath, 'utf-8'))
  : [];

function saveProjects() {
  fs.writeFileSync(projectsDbPath, JSON.stringify(projects, null, 2));
}

// Load carousel images from file
const carouselDbPath = path.join(__dirname, 'carousel-images.json');
let carouselImages = fs.existsSync(carouselDbPath)
  ? JSON.parse(fs.readFileSync(carouselDbPath, 'utf-8'))
  : [];

function saveCarouselImages() {
  fs.writeFileSync(carouselDbPath, JSON.stringify(carouselImages, null, 2));
}

// --- PROJECTS ROUTES ---

// Get all projects
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// Create new project (with max 5 images)
app.post('/api/projects', uploadProjects.array('images', 5), (req, res) => {
  const { title, description } = req.body;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'At least one image is required.' });
  }

  const imageUrls = req.files.map(file => `http://localhost:${PORT}/uploads/${file.filename}`);

  const newProject = {
    id: uuidv4(),
    title,
    description,
    imageUrls
  };

  projects.push(newProject);
  saveProjects();
  res.status(201).json(newProject);
});

// Update an existing project
app.put('/api/projects/:id', uploadProjects.array('images', 5), (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const project = projects.find(p => p.id === id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Update title and description
  if (title) project.title = title;
  if (description) project.description = description;

  // If new images uploaded, replace existing ones
  if (req.files && req.files.length > 0) {
    // Delete old images from disk
    project.imageUrls.forEach(url => {
      const localPath = path.join(__dirname, url.replace(`http://localhost:${PORT}/`, ''));
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    });

    // Set new image URLs
    project.imageUrls = req.files.map(file => `http://localhost:${PORT}/uploads/${file.filename}`);
  }

  saveProjects();
  res.json({ message: 'Project updated successfully', project });
});


// Delete a project by ID and remove associated images
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projectIndex = projects.findIndex(p => p.id === id);

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Delete image files from disk
  const { imageUrls } = projects[projectIndex];
  imageUrls.forEach(url => {
    const localPath = path.join(__dirname, url.replace(`http://localhost:${PORT}/`, ''));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  });

  projects.splice(projectIndex, 1);
  saveProjects();
  res.json({ message: 'Project deleted successfully' });
});

// --- CAROUSEL IMAGES ROUTES ---

// Get all carousel images
app.get('/api/carousel-images', (req, res) => {
  res.json(carouselImages);
});

// Upload a single carousel image
app.post('/api/carousel-images', uploadCarousel.single('carouselImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  const newImage = {
    _id: uuidv4(),
    url: imageUrl
  };

  carouselImages.push(newImage);
  saveCarouselImages();

  res.status(201).json(newImage);
});

// Delete a carousel image by ID and remove file
app.delete('/api/carousel-images/:id', (req, res) => {
  const { id } = req.params;
  const index = carouselImages.findIndex(img => img._id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const image = carouselImages[index];
  const localPath = path.join(__dirname, image.url.replace(`http://localhost:${PORT}/`, ''));

  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }

  carouselImages.splice(index, 1);
  saveCarouselImages();

  res.json({ message: 'Image deleted successfully' });
});

// --- VIDEOS ROUTES ---

// Path for videos data
const videosDbPath = path.join(__dirname, 'videos.json');
// Load videos or initialize empty array
let videos = fs.existsSync(videosDbPath)
  ? JSON.parse(fs.readFileSync(videosDbPath, 'utf-8'))
  : [];

function saveVideos() {
  fs.writeFileSync(videosDbPath, JSON.stringify(videos, null, 2));
}

// Get all videos
app.get('/api/videos', (req, res) => {
  res.json(videos);
});

// Add a new video URL and title
app.post('/api/videos', (req, res) => {
  const { url, title } = req.body;

  if (!url || !title) {
    return res.status(400).json({ error: 'Both url and title are required.' });
  }

  // Basic URL validation (optional)
  try {
    new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  const newVideo = {
    id: uuidv4(),
    url,
    title
  };

  videos.push(newVideo);
  saveVideos();

  res.status(201).json(newVideo);
});

// Delete a video by ID
app.delete('/api/videos/:id', (req, res) => {
  const { id } = req.params;
  const index = videos.findIndex(v => v.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Video not found' });
  }

  videos.splice(index, 1);
  saveVideos();

  res.json({ message: 'Video deleted successfully' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Server is running at http://localhost:${PORT}`);
});
