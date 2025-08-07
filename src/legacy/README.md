# Legacy Code Archive

This folder contains the old monolithic implementation of Jarvis Bot that has been replaced by the new modular architecture.

## Structure

```
legacy/
├── index-old.ts          # Original monolithic index file
├── index-simple.ts       # Simplified version used during migration
├── index-test.ts         # Test index file
├── modules/              # Old module implementations
│   ├── audio/           # Audio processing (replaced by domains/audio-processing)
│   ├── classification/  # Message classification (integrated into audio-processing)
│   ├── fund-tracker/    # Fund tracking (replaced by domains/fund-management)
│   ├── github-discovery/# GitHub discovery feature
│   ├── kv-notes/        # KV note storage (replaced by domains/notes)
│   ├── portfolio-tracker/# Portfolio tracking (replaced by domains/portfolio)
│   ├── todo/            # Todoist integration
│   └── voice-sync/      # Voice sync features
├── router/              # Old routing logic
│   ├── AudioProcessor.ts # Old audio processor
│   └── commands/        # Command handlers
└── services-whatsapp/   # Old WhatsApp service implementations
    └── types.ts         # WhatsApp type definitions
```

## Migration Status

✅ **Fully Migrated to New Architecture:**
- Audio Processing → `src/domains/audio-processing/`
- Notes Management → `src/domains/notes/`
- Portfolio Tracking → `src/domains/portfolio/`
- Fund Management → `src/domains/fund-management/`
- WhatsApp Integration → `src/core/services/messaging/ZApiMessagingService.ts`

## New Architecture Benefits

The new modular architecture provides:
- **Domain-Driven Design**: Clear separation of business domains
- **Event-Driven Communication**: Modules communicate via EventBus
- **Dependency Injection**: ServiceFactory manages all dependencies
- **Lifecycle Management**: ModuleManager handles module initialization/cleanup
- **Type Safety**: Full TypeScript support with interfaces
- **Testability**: Each module can be tested independently

## Important Notes

⚠️ **This code is NOT used in production anymore!**

The production bot uses the new modular architecture at:
- Entry point: `src/index.ts`
- Core services: `src/core/`
- Domain modules: `src/domains/`

This legacy code is kept for reference only and may be removed in future versions.