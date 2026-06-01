/**
 * Central constants file for all shared enums, statuses, and configuration values
 * Eliminates magic strings and ensures consistency across the codebase
 */

// Request Statuses (matches Prisma enum)
export const REQUEST_STATUS = {
  DRAFT: 'BROUILLON',
  PENDING_MANAGER: 'EN_ATTENTE_CHEF',
  PENDING_HR: 'EN_ATTENTE_RH',
  APPROVED: 'APPROUVE',
  REJECTED: 'REJETE',
} as const;

// Task Statuses (matches Prisma enum)
export const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
} as const;

// Task Priority (matches Prisma enum)
export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

// Project Statuses (matches Prisma enum)
export const PROJECT_STATUS = {
  PENDING: 'EN_ATTENTE',
  IN_PROGRESS: 'EN_COURS',
  COMPLETED: 'TERMINE',
} as const;

// Evaluation Statuses (matches Prisma enum)
export const EVALUATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
} as const;

// User Roles (matches Prisma enum)
export const ROLE = {
  EMPLOYEE: 'COLLABORATEUR',
  MANAGER: 'CHEF',
  HR: 'RH',
} as const;

// Request Types (matches Prisma enum)
export const REQUEST_TYPE = {
  LEAVE: 'CONGE',
  AUTHORIZATION: 'AUTORISATION',
  DOCUMENT: 'DOCUMENT',
  LOAN: 'PRET',
} as const;

// Approval Types (matches Prisma enum)
export const APPROVAL_TYPE = {
  MANAGER_THEN_HR: 'CHEF_THEN_RH',
  DIRECT_HR: 'DIRECT_RH',
} as const;

// Conversation Types (matches Prisma enum)
export const CONVERSATION_TYPE = {
  PRIVATE: 'PRIVATE',
  GROUP: 'GROUP',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Common error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  INVALID_INPUT: 'Invalid input',
  INTERNAL_ERROR: 'Internal server error',
} as const;

export const AUTH_COOKIE_NAME = 'token';
export const PRE_AUTH_COOKIE_NAME = 'pre_auth_token';
export const TRUSTED_DEVICE_COOKIE_NAME = 'trusted_device_token';
export const SIGNATURE_PLACEHOLDER = 'Signature a venir';
export const SIGNATURES_PUBLIC_DIR = 'signatures';

// Default pagination values
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;



// Kafka Configuration
export const KAFKA = {
  CLIENT_ID: 'arabsoft-chat',
  BROKERS: [process.env.KAFKA_BROKER || 'localhost:9092'],
  TOPICS: {
    CHAT_MESSAGES: 'chat-messages',
  },
  GROUPS: {
    CHAT_GROUP: 'chat-group',
  },
} as const;

// Type exports for TypeScript (Simplified)
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];
export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
export type EvaluationStatus = typeof EVALUATION_STATUS[keyof typeof EVALUATION_STATUS];
export type Role = typeof ROLE[keyof typeof ROLE];
export type ConversationType = typeof CONVERSATION_TYPE[keyof typeof CONVERSATION_TYPE];
