/**
 * Types barrel export for EduAI Studio
 *
 * Note: To avoid naming conflicts, import specific types from their source files
 * when needed. For example:
 * - import { ModelType } from '@/types/model' (for model management)
 * - import { DatasetType } from '@/types/dataset' (for dataset features)
 */

// Re-export only from types that don't have conflicts
export * from './api-key'
export * from './auth'
export * from './errors'
export * from './quota'
export * from './session'
export * from './tool'
export * from './user'
export * from './user-management'

// For types with conflicts, import directly from their source files:
// - './agent' - Agent types (TokenUsage conflict with chat)
// - './chat' - Chat types (TokenUsage conflict with agent)
// - './model' - Model management types (ModelType, ModelStatus, ProviderWithModels conflict with dataset)
// - './dataset' - Dataset types (ModelType, ModelStatus, ProviderWithModels conflict with model)
// - './dashboard' - Dashboard types
