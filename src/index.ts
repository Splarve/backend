import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { jobPostRouter } from './features/job-posts';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/v1/workspaces/:org_handle/job-posts', jobPostRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log the error with more context if available (like from AppError)
  console.error("Error occurred:", {
    message: err.message,
    statusCode: err.statusCode,
    context: err.context,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Use statusCode from AppError if available, otherwise default to 500
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    // Avoid leaking sensitive context or stack traces in production
    // context: process.env.NODE_ENV === 'development' ? err.context : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});