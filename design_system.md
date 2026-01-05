
# 🎨 Council System: Elegant Design System

## Core Philosophy
**"Context is Capability"**
The UI should not look like a database admin panel. It should feel like a **Cockpit**.
-   **You don't "view" a member**; you *inhabit* a Session.
-   **You don't "edit" a row**; you *dispatch* an Action.

## 📐 Layout Structure

### 1. The Identity Bar (Top)
*   **Purpose**: Anchors the user's context.
*   **Visuals**:
    *   **Left**: Council Name (e.g., "Workers Council").
    *   **Right**: "You are **Alice**" (Badge showing Voting Power: 1 + 2 delegated).
    *   **Action**: `[Delegate Power]` button (Prominent, fluid).

### 2. The Stage (Main Content - 3 Columns)

#### A. The Network (Left - "Who is here")
*   **Purpose**: Honest Discovery & Relationships.
*   **Content**: List of Members.
*   **Elegance**:
    *   Show delegation flow visually (e.g., `Bob ↳ Alice`).
    *   If you are admin/powerful, actions appear on hover (e.g., `Revoke`).

#### B. The Work (Center - "What we are doing")
*   **Purpose**: Proposals & Actions.
*   **Content**: Stream of Proposal Cards.
*   **Card Design**:
    *   **Header**: Title + Status (Active/Passed).
    *   **Body**: The Action Description (e.g., "Post Message to Farmers").
    *   **Footer**: Your Vote (Toggle Switch) + Progress Bar (Yes/No vs Quorum).
*   **Fab (Floating Action Button)**: `+ New Proposal`.

#### C. The Feed (Right - "What happened")
*   **Purpose**: Proof of Execution.
*   **Content**: Timeline of executed actions & messages.
*   **Elegance**: Chat-like interface showing *system* messages (e.g., "Proposal #12 Passed -> Executed 'Post Message'").

---

## 🎭 Interaction Flows

### Delegation (Liquid Democracy)
Instead of a dry form:
1.  Click `[Delegate Power]` in Identity Bar.
2.  **Modal**: "Who do you trust?"
3.  List of peers with their current weight.
4.  Select -> **Animation**: Your power flows to them.

### Promposal Builder (Action Builder)
Instead of `Select Checkbox`:
1.  Click `+`.
2.  **Step 1: Intent**: Type description.
3.  **Step 2: Capabilities**: "Attach an Action".
    *   *Dropdown*: Select a Capability you hold (e.g., "Target: Farmers Council").
    *   *Verb*: Select method (e.g., "postMessage").
    *   *Payload*: Type message.
4.  **Confirm**: "Launch Proposal".

---

## 🎨 Visual Style (CSS Variables)
*   `--bg-app`: Deep Canvas (Dark Mode default).
*   `--accent-power`: Gold/Amber (for Voting Power).
*   `--accent-action`: Cyber Blue (for Execution).
*   `--surface-card`: Glassmorphism (Translucent layers).
