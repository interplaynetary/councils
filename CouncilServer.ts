
import { RpcTarget } from 'capnweb';
import { ICouncil, IMember, IProposalRef, MemberInfo, ProposalInfo, VoteDecision, Action, ProposalStatus } from './protocol';
import * as Zod from 'zod';

// Reuse Zod schemas from Council.ts if possible, or redefine simplified versions for internal logic
// For now, let's implement the core logic directly here, effectively porting Council.ts to this new structure

// ProposalRef declaration moved below to avoid circular dependency issues if any, or just for organization.
// Its implementation is near the end of the file.


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
            await this.member.vote(realProposal, decision);
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

    async delegate(delegateName: string): Promise<void> {
        this.member.delegateTo(delegateName);
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

    public sessionRevocations: Map<string, () => void> = new Map();

    async join(name: string): Promise<IMember> {
        let member = this.members.find(m => m.name === name);
        if (!member) {
            member = new Member(name, this);
            this.members.push(member);
        }

        const session = new MemberSession(member);
        const { proxy, revoke } = Proxy.revocable(session, {});

        // Store revocation handle (e.g., keyed by name for global ban, or UUID for specific session)
        // For simplicity, we key by name, so new logins replace old revocations if we were strict,
        // but here we just append or manage differently.
        // Let's allow multiple sessions but store them.
        // Actually, simple key by name allows us to "ban user" easily.
        this.sessionRevocations.set(name, revoke);

        return proxy;
    }

    revokeMember(name: string) {
        const revoke = this.sessionRevocations.get(name);
        if (revoke) {
            revoke();
            console.log(`[Security] Revoked session for ${name}`);
            this.sessionRevocations.delete(name);
        }
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

    async getMembers(): Promise<MemberInfo[]> {
        return this.members.map(m => ({
            name: m.name,
            votingPower: m.calculateVotingPower()
        }));
    }

    public messages: string[] = [];

    async postMessage(content: string): Promise<void> {
        this.messages.push(content);
        console.log(`[Council ${this.name}] New Message: ${content}`);
    }

    async getMessages(): Promise<string[]> {
        return this.messages;
    }

    // Internal methods (not exposed via RPC directly, but used by MemberSession)
    createProposal(creator: Member, description: string, actions: Action[]): Proposal {
        // AUTOMATIC SECURITY: Wrap any capabilities passed in actions
        // AUTOMATIC SECURITY: Wrap any capabilities passed in actions
        const secureActions = actions.map(action => {
            if (action.target) {
                // Detects if we are passed a raw capability (or even an already wrapped one, duplicate wrapping is safe)
                const { proxy, revoke } = Proxy.revocable(action.target, {});

                // We need to associate this revoke handle with the proposal we are about to create.
                // But we don't have the proposal yet.
                // We will attach it to the action temporarily or return it.
                return { ...action, target: proxy, _revoke: revoke };
            }
            return action;
        });

        const p = new Proposal(this, description, secureActions);

        // Extract the revocation handles and store them in the proposal
        secureActions.forEach((a: any) => {
            if (a._revoke) {
                p.grantRevocations.push(a._revoke);
            }
        });

        this.proposals.push(p);
        return p;
    }

    // ... Helper method for quorum etc
    calculateQuorum() {
        return Math.ceil(this.members.length * 0.5); // Simple 50%
    }
}

// ProposalRef logic integrated above
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
        return {
            description: this.proposal.description,
            votes: {
                yes: this.proposal.voteCount('yes'),
                no: this.proposal.voteCount('no')
            },
            quorum: this.proposal.council.calculateQuorum(),
            proposal: this.proposal
        };
    }

    async revokeGrants(): Promise<void> {
        this.proposal.revokeGrants();
    }
}

// Internal classes (not RpcTargets themselves, just data/logic holders)
class Member {
    constructor(public name: string, public council: Council) { }

    async vote(proposal: Proposal, decision: VoteDecision) {
        await proposal.registerVote(this, decision);
    }

    getVote(proposal: Proposal): VoteDecision | undefined {
        return proposal.votes.get(this);
    }

    public delegatedTo: Member | null = null;

    delegateTo(name: string) {
        const delegate = this.council.members.find(m => m.name === name);
        if (!delegate) throw new Error("Delegate not found");
        if (delegate === this) throw new Error("Cannot delegate to self");
        // Simple cycle detection could go here

        this.delegatedTo = delegate;
    }

    calculateVotingPower(): number {
        // Base power (1) + power of anyone delegating TO me
        // Simple recursive, careful of cycles in prod
        let power = 1;
        for (const m of this.council.members) {
            if (m.delegatedTo === this) {
                power += m.calculateVotingPower() - 1; // Add their power (minus their own base if logic differs, but here flow is sum)
                // Wait, if A->B, B has 2. If B->C, C has 3.
                // Simple recursion:
                // My power = 1 + sum(children.power)
                // BUT if I delegated, my power is 0?
                // Liquid democracy: If I vote directly, I use my power. If I delegate, my power flows.
                // Protocol: getInfo() checks effective power if I were to vote.
            }
        }

        // Correct Liquid Logic:
        // If I have delegated, my effective voting power *for myself* is 0 (unless I override, but here we view power).
        // Actually, usually 'votingPower' is what you yield.

        // Let's implement: Active Power.
        // If delegatedTo is set, my direct power is 0?
        // Usually yes.
        if (this.delegatedTo) return 0;

        // If I am not delegated, I hold my own + sources
        let sourcePower = 0;
        // Find everyone who delegates to me
        const sources = this.council.members.filter(m => m.delegatedTo === this);
        for (const s of sources) {
            // We need their *potential* power (1 + their sources)
            // But they have delegatedTo set, so their calculateVotingPower() returns 0.
            // We need a helper `getRawWeight()`
            sourcePower += s.getRawWeight();
        }
        return 1 + sourcePower;
    }

    getRawWeight(): number {
        let weight = 1; // My intrinsic vote
        const sources = this.council.members.filter(m => m.delegatedTo === this);
        for (const s of sources) {
            weight += s.getRawWeight();
        }
        return weight;
    }
}

class Proposal {
    public votes: Map<Member, VoteDecision> = new Map();
    public grantRevocations: (() => void)[] = [];

    constructor(public council: Council, public description: string, public actions: Action[]) { }

    revokeGrants() {
        if (this.grantRevocations.length > 0) {
            console.log(`[Security] Revoking ${this.grantRevocations.length} grants for proposal "${this.description}"`);
            this.grantRevocations.forEach(r => r());
            this.grantRevocations = []; // Clear them
        }
    }

    async registerVote(voter: Member, decision: VoteDecision) {
        this.votes.set(voter, decision);
        // Auto-execute if passed (Simplified logic)
        await this.checkPass();
    }

    voteCount(decision: VoteDecision) {
        let count = 0;
        for (const d of this.votes.values()) {
            if (d === decision) count++;
        }
        return count;
    }

    async checkPass(): Promise<boolean> {
        const yesVotes = this.voteCount('yes');
        const quorum = this.council.calculateQuorum();
        if (yesVotes >= quorum) {
            await this.execute();
            return true;
        }
        return false;
    }

    async execute() {
        console.log(`Executing proposal: "${this.description}"`);
        for (const action of this.actions) {
            try {
                if (action.target) {
                    // REAL EXECUTION:
                    // We assume target is an object (Stub/Capability) that has the method.
                    // In main.ts simulation, it is the actual Server instance.
                    // In Cap'n Web, it is the Proxy/Stub.
                    // We invoke it dynamically.
                    if (action.methodName) {
                        // @ts-ignore
                        await action.target[action.methodName](...action.methodArgs);
                        console.log(`[Execution] Called ${action.methodName} on remote target.`);
                    }
                } else {
                    console.log(`[Execution] No target capability. Just logging: ${action.description}`);
                }
            } catch (e) {
                console.error(`[Execution] Failed to execute action: ${action.description}`, e);
            }
        }
    }
}

export function createCouncilServer(name: string) {
    return new Council(name);
}
