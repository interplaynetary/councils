
import { RpcTarget } from 'capnweb';
import { ICouncil, IMember, IProposalRef, MemberInfo, ProposalInfo, VoteDecision, Action, ProposalStatus } from './protocol';
import * as Zod from 'zod';

// Reuse Zod schemas from Council.ts if possible, or redefine simplified versions for internal logic
// For now, let's implement the core logic directly here, effectively porting Council.ts to this new structure

class ProposalRef extends RpcTarget implements IProposalRef {
    constructor(private proposal: Proposal) {
        super();
    }

    async getInfo(): Promise<ProposalInfo> {
        return {
            description: this.proposal.description,
        };
    }

    async getStatus(): Promise<ProposalStatus> {
        // Calculate status on demand
        // Logic similar to Council.ts processProposals but for a single proposal
        return {
            description: this.proposal.description,
            votes: {
                yes: this.proposal.voteCount('yes'),
                no: this.proposal.voteCount('no')
            },
            quorum: this.proposal.council.calculateQuorum(),
            proposal: this.proposal // Note: passing full object might not serialize perfectly if not careful, but for local testing it's fine. 
            //Ideally we return DTOs.
        };
    }
}


class MemberSession extends RpcTarget implements IMember {
    constructor(private member: Member) {
        super();
    }

    async propose(description: string, actions: Action[]): Promise<IProposalRef> {
        // Convert array of actions back to Map if internal logic needs it, 
        // or refactor internal logic to use arrays.
        // For this implementation, we'll stick to arrays for simplicity where possible.

        // Note: actions here contain { targetCouncil: ICouncil, ... }
        // We need to handle how ICouncil stubs are used.
        // For the MVP, let's assume local references or properly proxied stubs.

        const proposal = this.member.council.createProposal(this.member, description, actions);
        return new ProposalRef(proposal);
    }

    async vote(proposalRef: IProposalRef, decision: VoteDecision): Promise<void> {
        // We need to map the IProposalRef back to the internal Proposal object.
        // In a true distributed system, we'd use an ID.
        // For this single-process simulation, we can cheat slightly or use a lookup.

        // Better: IProposalRef is a stub. We can't easily get the 'real' object from a stub across the wire.
        // BUT, if we are in the same process (which we are for now), we can weakly referencing or using IDs.

        // Design choice: protocol.ts uses IProposalRef.
        // But the internal logic needs the real Proposal object.
        // Let's assume for now we pass the ID or the ref allows us to resolve it server-side.
        // Actually, preventing "forge" means we shouldn't trust the client to pass the proposal object back if we can't verify it.

        // If the client passes a stub, we receive a stub.
        // We can't "unwrap" a stub to get the server-side object easily unless we have a registry.

        // Let's rely on an internal ID registry for now to keep it robust.
        // So we might need to change the protocol slightly to accept IProposalRef OR an ID string?
        // Or, we assume the server can lookup the proposal based on the stub identity (advanced capnweb usage).

        // SIMPLIFICATION: We will add an ID to IProposalRef and pass that ID to vote.
        // Wait, `vote(proposal: IProposalRef, ...)`
        // If we pass the stub, Cap'n Web gives us... a stub or the headers.

        // Actually, if we use the object capability pattern strictly:
        // proposal.vote('yes') ? No, members vote.

        // Let's stick to ID lookup for this phase to ensure it works reliably without deep Cap'n Web magic knowledge.
        // So IProposalRef needs an ID.

        const info = await proposalRef.getInfo(); // This is an RPC call if remote!
        // This is inefficient.

        // Alternative: MemberSession methods take IDs.
        // But we want object capabilities.
        // Maybe: `proposalRef.castVote(decision)` ? 
        // But then who is voting? The capability holder of proposalRef? 
        // A proposalRef is public read-access usually.

        // Let's go back to: MemberSession.vote(proposalId, decision)
        // Or MemberSession.vote(proposalRef) where we extract ID from proposalRef (assuming we can trusted-ly get it).

        // Let's implement looking up by ID for simplicity.
        // Client gets ProposalRef, calls `await proposalRef.getId()`, then calls `member.vote(id, decision)`.
        // This is little less "pure capability" but practical.

        // OR:
        // `proposalRef` typically points to an export.
        // If we run everything in one process, we can maybe cheat.
        // But let's build for distribution.

        // Let's add `getId()` to IProposalRef.
        const id = (proposalRef as any).id; // If we implement it locally.
        // If remote, we need to await it.
        // Let's execute the vote by looking up the description/ID.

        // For MVP, since we don't have unique IDs in original logic (just descriptions), using description as key.
        const info2 = await proposalRef.getInfo();
        const realProposal = this.member.council.proposals.find(p => p.description === info2.description);

        if (realProposal) {
            this.member.vote(realProposal, decision);
        } else {
            throw new Error("Proposal not found");
        }
    }

    async getVote(proposalRef: IProposalRef): Promise<VoteDecision | undefined> {
        // We need to resolve the proposal to get the specific vote
        const info = await proposalRef.getInfo();
        const realProposal = this.member.council.proposals.find(p => p.description === info.description);

        if (realProposal) {
            return this.member.getVote(realProposal);
        }
        return undefined;
    }

    async delegate(targetCouncilStub: ICouncil, delegateName: string): Promise<void> {
        // Similar issue with wrapping/unwrapping ICouncil.
        // We receive a stub for targetCouncil.
        // We can pass that stub into our internal storage.
        // When we need to execute an action on that council, we call methods on the stub.
        // This is actually perfect! We don't need the "real" object, just the stub to call `addMember` etc later.

        this.member.delegateTo(targetCouncilStub, delegateName);
    }

    async getInfo(): Promise<MemberInfo> {
        return {
            name: this.member.name,
            votingPower: this.member.calculateVotingPower()
        };
    }
}

class Council extends RpcTarget implements ICouncil {
    public name: string;
    public proposals: Proposal[] = [];
    public members: Member[] = [];
    public delegates: any[] = []; // We can type this better later

    constructor(name: string) {
        super();
        this.name = name;
    }

    async join(name: string): Promise<IMember> {
        let member = this.members.find(m => m.name === name);
        if (!member) {
            member = new Member(name, this);
            this.members.push(member);
        }
        return new MemberSession(member);
    }

    async getProposal(description: string): Promise<IProposalRef> {
        const p = this.proposals.find(p => p.description === description);
        if (!p) throw new Error("Not found");
        return new ProposalRef(p);
    }

    async getProposals(): Promise<IProposalRef[]> {
        return this.proposals.map(p => new ProposalRef(p));
    }

    async getName(): Promise<string> {
        return this.name;
    }

    // Internal methods (not exposed via RPC directly, but used by MemberSession)
    createProposal(creator: Member, description: string, actions: Action[]): Proposal {
        const p = new Proposal(this, description, actions);
        this.proposals.push(p);
        return p;
    }

    // ... Helper method for quorum etc
    calculateQuorum() {
        return Math.ceil(this.members.length * 0.5); // Simple 50%
    }
}

// Internal classes (not RpcTargets themselves, just data/logic holders)
class Member {
    constructor(public name: string, public council: Council) { }

    vote(proposal: Proposal, decision: VoteDecision) {
        proposal.registerVote(this, decision);
    }

    getVote(proposal: Proposal): VoteDecision | undefined {
        return proposal.votes.get(this);
    }

    calculateVotingPower() {
        return 1; // Simplify for now
    }

    delegateTo(targetCouncilStub: ICouncil, name: string) {
        // Store delegation info
        // In distributed mode, we hold the stub.
    }
}

class Proposal {
    public votes: Map<Member, VoteDecision> = new Map();

    constructor(public council: Council, public description: string, public actions: Action[]) { }

    registerVote(voter: Member, decision: VoteDecision) {
        this.votes.set(voter, decision);
    }

    voteCount(decision: VoteDecision) {
        let count = 0;
        for (const d of this.votes.values()) {
            if (d === decision) count++;
        }
        return count;
    }
}

export function createCouncilServer(name: string) {
    return new Council(name);
}
