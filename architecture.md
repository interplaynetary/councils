
# System Architecture & Mechanics

This document visualizes the **Distributed Council System**, focusing on the Object Capability security model and the execution pipeline.

## 1. The Integrity: Joining & Session Creation
This flow demonstrates how a user acquires a **secure, revocable capability** (the Member Session) to interact with a Council. Note that the Council never returns a raw object; it always wraps it in a revocable proxy managed by the system.

```mermaid
sequenceDiagram
    participant User
    participant Council
    participant Member as Member (Internal)
    participant Session as MemberSession (Capability)
    participant SEC as Security Layer (Proxy)

    User->>Council: join("Alice")
    Council->>Member: Find or Create Member("Alice")
    Member-->>Council: Returns Member Object
    
    Council->>Session: new MemberSession(member)
    Session-->>Council: Returns Session (Raw Capability)
    
    Note over Council, SEC: 🔒 Security Step
    Council->>SEC: Proxy.revocable(session)
    SEC-->>Council: Returns { proxy, revoke }
    
    Council->>Council: Store revoke() handle in sessionRevocations
    
    Council-->>User: Returns Proxy<MemberSession>
    
    Note right of User: User now holds a "Key"<br/>to the Council.
```

## 2. The Flow: Proposal & Automatic Security
This diagram illustrates the **Zero-Trust** nature of the proposal system. When a member proposes an action that uses an external capability (like access to another council), the system **automatically intercepts and wraps** that capability before it enters the Proposal state. This ensures "Least Privilege" and allows the grant to be revoked later.

```mermaid
sequenceDiagram
    participant Alice as Alice (Session)
    participant Council
    participant Proposal
    participant Target as TargetCouncil (Capability)
    participant SEC as Security Layer

    Note over Alice: Alice holds a capability<br/>to TargetCouncil

    Alice->>Council: propose("Greetings", [Action{ target: Target }])
    
    Note over Council: 🛡️ Automatic Security Check
    loop For each Action
        Council->>SEC: Proxy.revocable(action.target)
        SEC-->>Council: Returns { proxy, revoke }
    end
    
    Council->>Proposal: new Proposal(..., [Action{ target: Proxy }])
    
    Council->>Proposal: Store revoke() handles in `grantRevocations`
    
    Proposal-->>Council: Proposal Created
    
    Council-->>Alice: Returns ProposalRef
    
    Note over Proposal: The Proposal now holds<br/>a RESTRICTED version<br/>of the Target capability.
```

## 3. The Execution: Voting & Cross-Council RPC
This flow shows the "muscle" of the system. Once quorum is met, the system executes the action using the **wrapped capability** stored in the proposal.

```mermaid
sequenceDiagram
    participant Bob as Bob (Session)
    participant Proposal
    participant Target as TargetCouncil (Proxy)
    participant Remote as Real Remote Council

    Bob->>Proposal: vote("yes")
    Proposal->>Proposal: checkPass()
    
    opt Quorum Met (e.g. > 50%)
        Proposal->>Proposal: execute()
        
        loop For each Action
            Note over Proposal, Target: Using the Secured Proxy
            Proposal->>Target: postMessage("Hello!")
            Target->>Remote: RPC Call executed
            Remote-->>Target: Ack
        end
        
        Note right of Proposal: Execution Complete
    end
```

## 4. The Fluidity: Revocation
How the system handles revocation of either a Member or a Proposal's grants.

```mermaid
stateDiagram-v2
    state "Active State" as Active {
        [*] --> Working
        Working --> Revoked : Admin calls revoke()
    }

    state "Revoked State" as RevokedState {
        Revoked --> Blocked
    }

    Working: Proxy forwards calls
    Blocked: Proxy throws TypeError
    
    note right of Blocked
        "Cannot perform 'get' on a 
        proxy that has been revoked"
    end note
```
