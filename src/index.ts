import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { jobPostRouter } from './features/job-posts';
import { orgSettingsRouter } from './features/org-settings';
import { organizationRouter, invitationActionsRouter, appPermissionsRouter } from './features/organizations';
import { currentUserRouter } from './features/currentUser';
import { departmentRouter } from './features/departments';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Conditionally setup Swagger documentation
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');

  // Swagger definition (remains largely the same, but you could alter title/description for non-prod)
  const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
      title: 'Splarve Backend API (Dev/Staging)', // Indicate non-production
      version: '1.0.0',
      description: 'API documentation for the Splarve backend services. THIS IS FOR DEVELOPMENT/STAGING.',
      contact: {
        name: 'Splarve Team',
      },
    },
    servers: [
      {
        url: `/api/v1`, 
        description: 'Development/Staging server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { 
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
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
                  details: { 
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
    security: [
      {
        bearerAuth: [],
      },
    ],
  };

  // Options for swagger-jsdoc
  const swaggerOptions = {
    swaggerDefinition,
    apis: ['./src/features/**/*.ts'],
  };

  // Initialize swagger-jsdoc
  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`API documentation available at /api-docs (NODE_ENV: ${process.env.NODE_ENV})`);
} else {
  console.log('API documentation is disabled in production environment.');
}

// Routes
app.use('/api/v1/app-permissions', appPermissionsRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/invitations', invitationActionsRouter);
app.use('/api/v1/organizations/:org_handle/job-posts', jobPostRouter);
app.use('/api/v1/organizations/:org_handle/departments', departmentRouter);
app.use('/api/v1/organizations/:org_handle/settings', orgSettingsRouter);
app.use('/api/v1/me', currentUserRouter);

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