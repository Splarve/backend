import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { jobPostRouter } from './features/job-posts';
import { orgSettingsRouter } from './features/org-settings';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Splarve Backend API',
    version: '1.0.0', // You can update this as your API evolves
    description: 'API documentation for the Splarve backend services, including job posts and organization settings.',
    contact: {
      name: 'Splarve Team',
      // url: 'https://yourwebsite.com', // Optional
      // email: 'youremail@example.com' // Optional
    },
  },
  servers: [
    {
      url: `/api/v1`, // Dynamically construct based on how you access your API (e.g. http://localhost:3000/api/v1) - this assumes prefix is handled by routers
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { // Assuming you use Bearer token auth (e.g. Supabase JWTs)
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    // We will define schemas in the respective validation files or route files
    schemas: {
        Error: {
            type: 'object',
            properties: {
                error: {
                    type: 'string',
                    description: 'A message describing the error.'
                },
                context: {
                    type: 'object',
                    description: 'Optional error context.'
                },
                details: { // For Zod validation errors
                    type: 'array',
                    items: {
                        type: 'object'
                    },
                    description: 'Optional validation error details.'
                }
            }
        }
    }
  },
  security: [ // Apply Bearer token auth globally to all routes. Can be overridden per-route.
    {
      bearerAuth: [],
    },
  ],
};

// Options for swagger-jsdoc
const swaggerOptions = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions (JSDoc comments)
  // Adjusted to scan .ts files within features subdirectories.
  apis: ['./src/features/**/*.ts'],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
// The UI will be available at <your_base_url>/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/v1/workspaces/:org_handle/job-posts', jobPostRouter);
app.use('/api/v1/workspaces/:org_handle/settings', orgSettingsRouter);

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