// src/lib/validation.ts
import type { Request, Response, NextFunction } from 'express'
import type { AnyZodObject } from 'zod'
import { ZodError } from 'zod'

export const validate = {
  body: (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = await schema.parseAsync(req.body)
        next()
      } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
            error: 'Body validation failed',
            details: error.errors
            });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    }
  },
  
  params: (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        req.params = await schema.parseAsync(req.params);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({
            error: 'URL parameter validation failed',
            details: error.errors,
          });
        } else {
          res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    };
  },
  
  query: (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        req.query = await schema.parseAsync(req.query);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({
            error: 'Query parameter validation failed',
            details: error.errors,
          });
        } else {
          res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    };
  },
};