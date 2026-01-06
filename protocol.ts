
import { Action, VoteDecision, ProposalStatus as ZodProposalStatus } from './Council';

// Re-export necessary types
export type { Action, VoteDecision };
export type ProposalStatus = ZodProposalStatus;

// Basic info interfaces (passive data structures)
export interface IPublicIdentity {
    getName(): Promise<string>;
}

export interface MemberInfo {
    name: string;
    votingPower: number;
    identity: IPublicIdentity; // The Capability
}

export interface ProposalInfo {
    description: string;
    actions: Action[];
}

// RPC Interfaces

/**
 * Represents a reference to a Proposal on the server.
 * This is an RPC Target.
 */
export interface IProposalRef {
    getInfo(): Promise<ProposalInfo>;
    getStatus(): Promise<ProposalStatus>;
    /**
     * Revoke any capabilities granted by this proposal.
     * Useful if the proposal contains sensitive actions (like cross-council calls).
     */
    revokeGrants(): Promise<void>;
}

/**
 * Represents a Member's session/capability.
 * Holding this object proves you are this member.
 * This is an RPC Target.
 */
export interface IMember {
    /**
     * Create a new proposal.
     * Returns a promise for the Proposal reference.
     * This allows pipelining: alice.vote(alice.propose(...), 'yes')
     */
    propose(description: string, actions: Action[]): Promise<IProposalRef>;

    /**
     * Cast a vote on a proposal.
     * @param proposal The proposal reference to vote on.
     * @param decision The vote decision.
     */
    vote(proposal: IProposalRef, decision: VoteDecision): Promise<void>;

    /**
     * Get the member's current vote on a proposal.
     */
    getVote(proposal: IProposalRef): Promise<VoteDecision | undefined>;

    /**
     * Delegate voting power to another member in this council.
     * @param delegateName The name of the member to delegate to.
     */
    delegate(delegateName: string): Promise<void>;

    /**
     * Get info about this member (name, voting power).
     */
    getInfo(): Promise<MemberInfo>;
}

/**
 * The public gateway to a Council.
 * This is an RPC Target.
 */
export interface ICouncil {
    /**
     * Join the council with a given name.
     * Returns a Member capability (session).
     */
    join(name: string): Promise<IMember>;

    /**
     * Get a specific proposal by ID (if we have IDs) or description.
     * For now let's assume we can lookup by description or strict ID.
     */
    getProposal(descriptionOrId: string): Promise<IProposalRef>;

    /**
     * Get all active proposals.
     */
    getProposals(): Promise<IProposalRef[]>;

    /**
     * Get general info about the council
     */
    getName(): Promise<string>;

    /**
     * Get list of members in the council (Public discovery).
     */
    getMembers(): Promise<MemberInfo[]>;

    /**
     * Post a public message to the council's feed (Execution side-effect).
     */
    postMessage(content: string): Promise<void>;

    /**
     * Get the council's public message feed.
     */
    getMessages(): Promise<string[]>;
}
