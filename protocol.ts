
import { Action, VoteDecision, ProposalStatus as ZodProposalStatus } from './Council';

// Re-export necessary types
export type { Action, VoteDecision };
export type ProposalStatus = ZodProposalStatus;

// Basic info interfaces (passive data structures)
export interface MemberInfo {
    name: string;
    votingPower: number;
}

export interface ProposalInfo {
    description: string;
    // We can add more metadata here that doesn't change often
}

// RPC Interfaces

/**
 * Represents a reference to a Proposal on the server.
 * This is an RPC Target.
 */
export interface IProposalRef {
    getInfo(): Promise<ProposalInfo>;
    getStatus(): Promise<ProposalStatus>;
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
     * Delegate voting power to another council's member.
     * @param targetCouncil The council to delegate to (passed as capability if needed, or by name/ID?)
     * Note: In a fully distributed system, targetCouncil might be an ICouncil reference.
     */
    delegate(targetCouncil: ICouncil, delegateName: string): Promise<void>;

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
}
