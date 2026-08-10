const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function ensureCloudinaryConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the backend environment.');
  }
}

function resourceTypeFor(type) {
  if (type === 'image' || type === 'avatar') return 'image';
  if (type === 'video' || type === 'audio') return 'video';
  return 'auto';
}

function uploadBuffer(file, { folder, type }) {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `ruphen/${folder}`,
        resource_type: resourceTypeFor(type),
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
