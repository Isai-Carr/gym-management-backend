import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  SMTP_HOST: Joi.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().optional().default('noreply@oasisgym.com'),
  FRONTEND_URL: Joi.string().optional().default('http://localhost:3001'),
  ALLOWED_ORIGINS: Joi.string().optional().allow(''),
}).unknown(true);
