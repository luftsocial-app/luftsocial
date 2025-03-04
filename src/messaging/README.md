# Messaging Module Sprint Plan

 ## Implementation Status
 ![Progress](https://img.shields.io/badge/Progress-60%25-yellowgreen)


 ### Core Implemented Features
 ```mermaid
 pie
     title Completed Features
     "Message Send/Receive" : 35
     "Conversation Creation" : 25
     "WebSocket Basics" : 20
     "Read Receipts" : 15
     "Typing Indicators" : 5
 ```

 ## Phase 1: Core Message System (1 Week)

 ### MSG-101: Message Lifecycle Management
 **Objective:** Full message CRUD operations  
 **Files**:
 - `src/entities/chats/message.entity.ts` (Add edit history)
 - `src/messaging/message/message.service.ts` (Edit/Delete logic)
 - `src/messaging/gateway/chat.gateway.ts` (WS events)
 - `src/messaging/dtos/message.dto.ts` (New DTOs)

 **Implementation**:
 1. Add message edit endpoint (`PATCH /messages/:id`)
 2. Implement soft-delete with retention policy
 3. Add edit history tracking array in Message entity
 4. WebSocket events: `message:updated`, `message:deleted`
 5. Add message versioning system
 6. Implement deletion policy (user vs admin)

 **Tests**:
 - Edit conflict resolution tests
 - Cross-tenant deletion validation
 - WS event payload validation

 ---

 ### MSG-102: Message Reactions System
 **Objective:** Emoji reaction management  
 **Files**:
 - `src/entities/chats/message.entity.ts` (metadata.reactions)
 - `src/messaging/message/message.controller.ts` (Reaction endpoints)
 - `src/messaging/gateway/chat.gateway.ts` (Reaction events)

 **Implementation**:
 1. ReactionDTO with emoji validation
 2. Endpoints: 
    - `POST /messages/:id/reactions` 
    - `DELETE /messages/:id/reactions`
 3. Reaction aggregation logic
 4. WS events: `reaction:added`, `reaction:removed`
 5. Rate limiting (5 reactions/min/user)

 **Dependencies**: MSG-101  
 **Risks**: Emoji sanitization, race conditions

 ---

 ## Phase 2: Conversation Management (1 Week)

 ### MSG-201: Participant System
 **Objective:** Complete participant management  
 **Files**:
 - `src/messaging/chat/chat.service.ts` (Participant methods)
 - `src/entities/chats/chat-participants.entity.ts` (Roles)
 - `src/messaging/gateway/chat.gateway.ts` (Participant events)

 **Implementation**:
 1. Participant roles (Member, Admin, Owner)
 2. Endpoints:
    - `POST /conversations/:id/participants`
    - `DELETE /conversations/:id/participants`
 3. Invitation system with JWT tokens
 4. WS events: `participant:added`, `participant:removed`

 **Tests**: Role escalation prevention

 ---

 ### MSG-202: Conversation Settings
 **Objective:** Conversation customization  
 **Files**:
 - `src/entities/chats/conversation.entity.ts` (Settings column)
 - `src/messaging/dtos/conversation.dto.ts` (Validation)
 - `src/messaging/chat/chat.controller.ts` (Settings endpoints)

 **Implementation**:
 1. PATCH `/conversations/:id/settings`
 2. Settings includes:
    - Avatar management
    - Color themes
    - Notification defaults
 3. WS synchronization
 4. Versioned settings history

 ---

 ## Phase 3: Advanced Features (1 Week)

 ### MSG-301: Message Attachments
 **Objective:** File attachment support  
 **Files**:
 - `src/entities/chats/attachment.entity.ts` (New entity)
 - `src/messaging/services/file.service.ts` (New service)
 - `src/messaging/message/message.controller.ts` (Attachment endpoints)

 **Implementation**:
 1. Attachment entity with S3 metadata
 2. File type validation (whitelist/blacklist)
 3. Virus scanning integration
 4. Thumbnail generation
 5. Attachment cleanup cron job

 ---

 ### MSG-302: Message Threads
 **Objective:** Threaded conversations  
 **Files**:
 - `src/entities/chats/message.entity.ts` (parentMessage)
 - `src/messaging/message/message.service.ts` (Thread logic)
 - `src/messaging/gateway/chat.gateway.ts` (Thread events)

 **Implementation**:
 1. Thread creation endpoints
 2. Nested reply support
 3. Thread participation tracking
 4. WS events: `thread:created`, `thread:updated`

 ---

 ## Phase 4: Security & Performance (1 Week)

 ### MSG-401: End-to-End Encryption
 **Objective:** Message encryption  
 **Files**:
 - `src/messaging/services/crypto.service.ts` (New service)
 - `src/entities/chats/conversation.entity.ts` (encryption metadata)
 - `src/messaging/message/message.controller.ts` (Encryption middleware)

 **Implementation**:
 1. Key exchange protocol
 2. Message encryption/decryption flows
 3. Device synchronization
 4. Key rotation system

 ---

 ### MSG-402: Performance Optimization
 **Objective:** Scale message delivery  
 **Files**:
 - `src/messaging/message/message.service.ts` (Pagination)
 - `src/messaging/gateway/chat.gateway.ts` (WS optimizations)
 - `src/messaging/services/cache.service.ts` (Redis integration)

 **Implementation**:
 1. Cursor-based pagination
 2. Message archiving system
 3. Redis caching layer
 4. WS connection pooling

 ---

 ## Key Implementation Details

 ### Database Schema
 ```mermaid
 erDiagram
     USER ||--o{ MESSAGE : sends
     USER ||--o{ CHAT_PARTICIPANT : is
     CONVERSATION ||--o{ MESSAGE : contains
     MESSAGE ||--o{ ATTACHMENT : has
     MESSAGE ||--o{ MESSAGE : "thread replies"
     CONVERSATION ||--o{ CHAT_PARTICIPANT : has
 ```

 ### WebSocket Events Matrix
 | Event               | Emitter          | Listener          | Payload                                  |
 |---------------------|------------------|-------------------|------------------------------------------|
 | message:created     | Server           | Conversation Room | Full message object                      |
 | message:updated      | Server           | Conversation Room | Message ID + patch                       |
 | reaction:added       | Server           | Conversation Room | Message ID + reaction data               |
 | participant:updated  | Server           | Conversation Room | Participant ID + new role                |

 ### Branch Strategy
 ```bash
 # Feature Development
 git flow feature start MSG-101-message-mutations
 git flow feature finish MSG-101-message-mutations

 # Hotfixes
 git flow hotfix start msg-typing-indicator-fix
 ```

 ## Quality Standards

 1. **Testing**:
    - 90%+ unit test coverage
    - Load testing for WS endpoints
    - Security penetration tests for encryption

 2. **Monitoring**:
    ```mermaid
    graph TD
      A[Prometheus] --> B(Message Delivery Rate)
      A --> C(WS Connection Health)
      A --> D(Reaction Usage)
      B --> E[Grafana Dashboard]
    ```

 3. **Documentation**:
    - OpenAPI spec updates
    - WS event documentation
    - Data flow diagrams

 ## Future Roadmap

 ```mermaid
 gantt
     title Current Tasks
     dateFormat  YYYY-MM-DD
     section Current Sprint
     MSG-101 Message Lifecycle :active, 2025-05-04, 7d
     MSG-102 Reactions        :2025-05-11, 7d
     MSG-201 Participants     :2025-05-18, 7d
     MSG-202 Settings        :2025-05-25, 7d
 ```

 This enhanced plan provides complete implementation visibility while maintaining technical precision. Each ticket includes specific code integration points and quality requirements.