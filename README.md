# Councils

**A flexible framework for coordinated decision-making across interconnected autonomous groups.**

At its core, it enables groups (councils) to make decisions that affect both their internal operations and their relationships with other groups, while maintaining clear lines of accountability and democratic control.

## Core Concepts

### 📜 Proposals
- **Structured Decisions**: Everything flows through proposals.
- **Actionable**: Proposals specify actions (execute methods, trigger changes) for one or multiple councils.
- **Unified Mechanism**: From simple votes to complex inter-council coordination, it all uses the same proposal system.

### 🤝 Delegates & Mandates
- **Continuous Legitimacy**: Delegation works via "mandate" proposals.
- **Dynamic Authority**: A delegate's voting power is tied directly to the ongoing support of their mandate in their home council.
- **Revocable**: If support for a mandate drops, the delegate's power adjusts or is revoked automatically.

### 🌐 Inter-Council Relationships
- **Coordinated Autonomy**: Councils can specify actions for *other* councils within a proposal.
- **Member Accountability**: The system tracks acceptance/rejection of these decisions, allowing for review of membership relationships based on cooperation.

## Technical Highlights
- **Secure**: Uses `Proxy.revocable` for controlled access.
- **Robust**: TypeScript & Zod schemas for type safety and validation.
- **Modern**: Async iterators for handling proposal lifecycles.

## Quick Start
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```