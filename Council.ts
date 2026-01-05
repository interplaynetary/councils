import { z } from 'zod';

// ==========================================
// Zod Schemas & Types
// ==========================================

// Action Schema
const ActionSchema = z.object({
    description: z.string(),
    methodName: z.string().optional(),
    methodArgs: z.array(z.any()).default([]),
});
export type Action = z.infer<typeof ActionSchema>;

// We need a recursive or forward declaration for Council since Proposal uses it
// For now, we'll use a placeholder for the keys in Map
// In the original code, Proposal.actions is new Map() where key is Council (object) and value is Action

// Proposal Schema Base
// Since we can't easily put complex class instances as keys in Zod schemas directly for validation 
// without custom logic, we will define the structure of what we pass mostly.
// However, internally we store Maps.
// We'll define the "Structure" of a proposal as it might be serialized, 
// but for the class usage we will keep using Map<Council, Action>

const VoteDecisionSchema = z.enum(['yes', 'no']);
export type VoteDecision = z.infer<typeof VoteDecisionSchema>;

const VoteStatusSchema = z.object({
    yes: z.number(),
    no: z.number(),
});

export const ProposalStatusSchema = z.object({
    description: z.string(),
    votes: VoteStatusSchema,
    quorum: z.number(),
    proposal: z.any()
});
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

// ==========================================
// Interfaces (for class structure)
// ==========================================

// Forward declaration interfaces
interface ICouncil {
    name: string;
    proxyRef: ICouncil;
    addProposal(description: string, actions?: Map<ICouncil, Action>): Proposal;
    castVote(voter: IMember | IDelegate, proposal: Proposal, decision: VoteDecision): void;
    removeDelegate(delegate: IDelegate): void;
    memberVotingPower: number;
    bootstrap(): {
        addMember(name: string): IMember;
        addMethod(name: string, method: Function): ICouncil
    };
}

interface IMember {
    name: string;
    council: ICouncil;
    castVote(proposal: Proposal, decision: VoteDecision): void;
}

interface IDelegate {
    name: string;
    mandate: Proposal;
    from: ICouncil;
    to: ICouncil;
    proxy: IDelegate;
    revoke?: () => void;
    propose(description: string, actions?: Map<ICouncil, Action>): void;
    castVote(proposal: Proposal, decision: VoteDecision): void;
}

// ==========================================
// Classes
// ==========================================

export class Delegate implements IDelegate {
    name: string;
    mandate: Proposal;
    from: ICouncil;
    to: ICouncil;
    // @ts-ignore: Proxy property is assigned later or handled by the creating Council
    proxy: IDelegate;
    revoke?: () => void;

    constructor(name: string, mandate: Proposal, from: ICouncil, to: ICouncil) {
        this.name = name;
        this.mandate = mandate;
        this.from = from;
        this.to = to;
    }

    propose(description: string, actions: Map<ICouncil, Action> = new Map()) {
        this.to.addProposal(description, actions);
    }

    // Cast a vote on a proposal
    castVote(proposal: Proposal, decision: VoteDecision) {
        const weight = this.mandate.supporters.length;
        console.log(`${this.name} votes ${decision} on proposal: ${proposal.description} with weight ${weight}`);
        this.to.castVote(this, proposal, decision);
    }
}

export class Proposal {
    description: string;
    votes: Map<IMember | IDelegate, VoteDecision>;
    actions: Map<ICouncil, Action>;

    constructor(description: string) {
        this.description = description;
        this.votes = new Map(); // Store delegate/member references and their vote
        this.actions = new Map(); // Map of council -> { description, methodName, methodArgs }
    }

    // Add an action for a specific council
    addAction(council: ICouncil, description: string, methodName: string | null = null, methodArgs: any[] = []) {
        // Validate with Zod
        const actionData = ActionSchema.parse({
            description,
            methodName,
            methodArgs
        });

        this.actions.set(council, actionData);
    }

    // Cast a vote on the proposal
    castVote(voter: IMember | IDelegate, vote: VoteDecision) {
        VoteDecisionSchema.parse(vote);
        this.votes.set(voter, vote);
    }

    // Get current vote totals, calculating weights appropriately
    getCurrentVotes(): z.infer<typeof VoteStatusSchema> {
        let yes = 0;
        let no = 0;

        this.votes.forEach((vote, voter) => {
            // If voter is a delegate, use mandate supporters length
            // Type guard to check if voter is delegate
            const isDelegate = (v: any): v is IDelegate => 'mandate' in v;

            const weight = isDelegate(voter) && voter.mandate ? voter.mandate.supporters.length : 1;

            if (vote === 'yes') {
                yes += weight;
            } else if (vote === 'no') {
                no += weight;
            }
        });

        return { yes, no };
    }

    // Get actions for a specific council
    getActionsForCouncil(council: ICouncil): Action | undefined {
        // Debug the lookup
        // console.log('Looking up actions for:', council);
        // console.log('Available actions:', Array.from(this.actions.entries()));

        // Use direct council reference (it's already a proxy)
        const action = this.actions.get(council);
        return action;
    }

    // Get all actions
    get allActions() {
        return Array.from(this.actions.entries()).map(([council, action]) => ({
            council: council.name,
            ...action
        }));
    }

    get supporters(): (IMember | IDelegate)[] {
        return Array.from(this.votes.entries())
            .filter(([_, vote]) => vote === 'yes')
            .map(([voter, _]) => voter);
    }
    // Added for compliance with original logic where boolean check was used

    // Allow dynamic properties
    [key: string]: any;
}

export class Member implements IMember {
    name: string;
    council: ICouncil;

    constructor(name: string, council: ICouncil) {
        this.name = name;
        this.council = council;
    }

    castVote(proposal: Proposal, decision: VoteDecision) {
        console.log(`${this.name} votes ${decision} on proposal: ${proposal.description}`);
        this.council.castVote(this, proposal, decision);
    }
}

export class Council implements ICouncil {
    #name: string;
    #members: (IMember | ICouncil)[] = [];
    #delegates: { proxy: IDelegate; revoke: () => void }[] = [];
    #proposals: Proposal[] = [];
    #pendingResponses: Map<ICouncil, Map<string, Proposal>> = new Map();

    // Allow dynamic method assignment
    [key: string]: any;

    // @ts-ignore: Initialized in createCouncil
    proxyRef: ICouncil;

    constructor(name: string) {
        this.#name = name;
    }

    // Bootstrap method - only available during initialization
    bootstrap() {
        return {
            addMember: (memberName: string) => {
                const member = new Member(memberName, this.proxyRef);
                this.#members.push(member);
                console.log(`Bootstrapped member ${member.name} added to ${this.#name}`);
                return member;
            },
            addMethod: (methodName: string, method: Function) => {
                this[methodName] = method;
                console.log(`Bootstrapped method ${methodName} added to ${this.#name}`);
                return this.proxyRef;  // Return proxy instead of 'this'
            }
        };
    }

    // Regular methods remain private/controlled
    get name() {
        return this.#name;
    }

    get members() {
        return [...this.#members];
    }

    // Getter for delegates - returns a copy of the delegates array
    get delegates() {
        // console.log('Getting delegates:', this.#delegates);
        return this.#delegates.map(delegate => delegate.proxy);
    }

    // Getter for proposals - returns a copy of the proposals array
    get proposals() {
        // Return the actual proposal objects instead of spreading them
        return [...this.#proposals];
    }

    addProposal(description: string, actions: Map<ICouncil, Action> = new Map()) {
        console.log('Adding proposal with actions:', actions);
        const proposal = new Proposal(description);

        // Add actions from the map
        actions.forEach((action, council) => {
            console.log(`Adding action for council ${council.name}:`, action);
            proposal.addAction(council, action.description, action.methodName, action.methodArgs);
        });

        this.#proposals.push(proposal);
        //console.log(`Proposal "${description}" added to ${this.#name}`);
        return proposal;
    }

    castVote(voter: IMember | IDelegate, proposal: Proposal, decision: VoteDecision) {
        // Check if voter is a direct member or a delegate from a member
        const isDirectMember = this.#members.includes(voter as any);

        // Check if delegate from member council
        const isDelegateFromMemberCouncil = 'mandate' in voter && voter.from &&
            this.#members.includes(voter.from);

        if (!isDirectMember && !isDelegateFromMemberCouncil) {
            console.log(`${voter.name} is not a member or delegate from a member of ${this.#name}`);
            return;
        }

        // Use the proposal's castVote method
        proposal.castVote(voter, decision);
        console.log(`${voter.name} votes ${decision} on proposal: ${proposal.description}`);
    }

    addMember(member: IMember | ICouncil) {
        this.#members.push(member);
    }

    electDelegate(delegateName: string, mandateDescription: string, targetCouncil: ICouncil) {
        console.log('Starting electDelegate method');
        const existingDelegate = this.#delegates.find(d => d.proxy.to === targetCouncil);
        if (existingDelegate) {
            console.log(`A delegate already exists for ${targetCouncil.name}. Cannot send another delegate.`);
            return;
        }

        // Find the mandate proposal
        const mandate = this.#proposals.find(p => p.description === mandateDescription);
        if (!mandate) {
            console.log(`No mandate proposal found with description: ${mandateDescription}`);
            return;
        }

        console.log('Using mandate proposal:', mandate);

        const { proxy: mandateProxy, revoke: revokeMandate } = Proxy.revocable(mandate, {});
        const delegate = new Delegate(delegateName, mandateProxy, this.proxyRef, targetCouncil);

        console.log('Delegate created:', delegate);

        const { proxy: delegateProxy, revoke: revokeDelegate } = Proxy.revocable(delegate, {});
        // Assign proxy to delegate instance for self-referencing if needed, or consistency
        delegate.proxy = delegateProxy;

        console.log('Current delegates before push:', this.#delegates);
        this.#delegates.push({ proxy: delegateProxy, revoke: revokeDelegate });
        console.log('Current delegates after push:', this.#delegates);

        console.log(`Delegate ${delegateProxy.name} created and added to ${this.#name}`);
        return delegateProxy;
    }

    withdrawDelegate(delegateProxy: IDelegate) {
        const delegateEntry = this.#delegates.find(d => d.proxy === delegateProxy);
        if (delegateEntry) {
            delegateEntry.revoke();
            this.#delegates = this.#delegates.filter(d => d.proxy !== delegateProxy);
            // @ts-ignore
            console.log(`${delegateProxy.name} with mandate "${delegateProxy.mandate.description}" has been revoked from ${this.#name}`);
            delegateProxy.to.removeDelegate(delegateProxy);
        }
    }

    substituteDelegate(delegateProxy: IDelegate, newDelegateName: string, newMandateDescription: string) {
        const delegateEntry = this.#delegates.find(d => d.proxy === delegateProxy);
        if (delegateEntry) {
            delegateEntry.revoke();
            const newMandate = new Proposal(newMandateDescription);
            const { proxy: newMandateProxy, revoke: revokeNewMandate } = Proxy.revocable(newMandate, {});
            const newDelegate = new Delegate(newDelegateName, newMandateProxy, this.proxyRef, delegateProxy.to);
            const { proxy: newDelegateProxy, revoke: revokeNewDelegate } = Proxy.revocable(newDelegate, {});
            newDelegate.proxy = newDelegateProxy;

            this.#delegates = this.#delegates.map(d => d.proxy === delegateProxy ? { proxy: newDelegateProxy, revoke: revokeNewDelegate } : d);
            console.log(`${delegateProxy.name} with mandate "${delegateProxy.mandate.description}" has been replaced by ${newDelegate.name} with mandate "${newDelegate.mandate.description}" in ${this.#name}`);
            delegateProxy.to.removeDelegate(delegateProxy);

            // Note: In original code, it mentioned `this.mandates` but that property didn't exist in the class definition.
            // Assuming it meant proposals acting as mandates? Or perhaps it was a bug in original code.
            // I will skip the `this.mandates` line as it seems undefined in the original class structure too.
        }
    }

    removeDelegate(delegate: IDelegate) {
        // Delegates are stored as { proxy, revoke }, but removeDelegate is called with the proxy ??
        // In original code: this.#delegates = this.#delegates.filter(d => d !== delegate);
        // But d in #delegates is { proxy, revoke }. So original code might have been buggy or expected delegate object not proxy.
        // If passed proxy, we filter by proxy.
        this.#delegates = this.#delegates.filter(d => d.proxy !== delegate);

        // Also original code: console.log(`${delegate.name} has been removed...`);
        // If it's a proxy it works.
        console.log(`${delegate.name} has been removed from ${this.#name}`);
    }

    // Execute the method on the council if the proposal is approved
    #execute(proposal: Proposal) {
        const actions = proposal.getActionsForCouncil(this.proxyRef);
        console.log('Executing proposal with actions:', actions);
        console.log('Available methods on council:', Object.getOwnPropertyNames(this));
        console.log('Looking for method:', actions?.methodName);

        if (actions && actions.methodName && typeof this[actions.methodName] === 'function') {
            console.log(`Executing method ${actions.methodName} on ${this.#name}`);
            this[actions.methodName](...actions.methodArgs);
        } else {
            console.log(`No valid method to execute for proposal: ${proposal.description}`);
            if (actions && actions.methodName) {
                console.log('Action exists but method not found. Action details:', {
                    methodName: actions.methodName,
                    methodExists: typeof this[actions.methodName],
                    methodArgs: actions.methodArgs
                });
            } else {
                console.log('No actions found for this council');
            }
        }
    }

    // Method to check member council responses
    async checkMemberResponses() {
        const responseStatus: any[] = [];

        for (const [council, proposals] of this.#pendingResponses) {
            for (const [description, proposal] of proposals) {
                // Determine completion status
                // In original code: proposal.isApproved, proposal.isComplete
                // These properties don't exist on Proposal by default in the original code, 
                // they were likely dynamic or assumed from context.
                // We'll mimic this or just assume proposal object might have it if extended

                // For now, let's mock it or just assume proposal object might have it if extended
                const status = {
                    council: council.name,
                    proposal: description,
                    accepted: (proposal as any).isApproved,
                    completed: (proposal as any).isComplete
                };
                responseStatus.push(status);

                // If proposal is complete and was rejected, consider revoking membership
                if (status.completed && !status.accepted) {
                    //console.log(`Warning: ${council.name} rejected proposal "${description}"`);
                    // Could trigger membership review process
                }
            }
        }

        return responseStatus;
    }

    // Revoke membership of a council
    revokeMembership(council: ICouncil) {
        this.#members = this.#members.filter(c => c !== council);
        console.log(`${council.name} has been revoked from ${this.#name}`);
    }

    addMethod(methodName: string, method: Function) {
        this[methodName] = method;
    }

    // Update voting power calculations
    get memberVotingPower(): number {
        return this.#members.reduce((sum, member) => {
            // If member is a council, count its members
            // We use 'member instanceof Council' check equivalent
            if (member && 'memberVotingPower' in member && typeof (member as ICouncil).memberVotingPower === 'number') {
                // Check if it's strictly a council-like object
                // In JS original: if (member instanceof Council)
                // But since we are using Proxies, instanceof might fail depending on setup.
                // We'll trust checking for memberVotingPower existence.
                return sum + (member as ICouncil).memberVotingPower;
            }
            // If individual member, count as 1
            return sum + 1;
        }, 0);
    }

    async *processProposals() {
        for (const proposal of this.#proposals) {
            const currentVotes = proposal.getCurrentVotes();

            // Calculate total voting power from both delegates and regular members
            const delegateVotingPower = this.#delegates
                .reduce((sum, delegate) => {
                    return sum + (delegate.proxy.mandate.supporters?.length || 0);
                }, 0);

            const memberVotingPower = this.#members.length;
            const totalVotingPower = delegateVotingPower + memberVotingPower;

            const quorum = totalVotingPower * 0.5;

            const isApproved = currentVotes.yes >= quorum;

            // Add status properties to proposal for checkMemberResponses
            (proposal as any).isApproved = isApproved;
            (proposal as any).isComplete = true; // Mark as processed

            const status = {
                proposal: proposal,  // Pass the entire proposal object
                description: proposal.description,
                votes: currentVotes,
                totalVotingPower,
                quorum,
                isApproved: isApproved
            };

            yield status;

            if (status.isApproved) {
                //console.log(`Proposal "${status.proposal.description}" is approved.`);
                this.#execute(status.proposal);  // Execute the approved proposal's actions

                // Send to member councils and track their responses
                const memberProposals = await Promise.all(this.#members
                    .filter(member => {
                        // Check if member is a council (has addProposal method)
                        return member && typeof (member as any).addProposal === 'function' && member !== this.proxyRef;
                        // Note: logic in original was instanceof Council. 
                        // Member class does NOT have addProposal. So checking function existence is safe.
                    })
                    .map(async member => {
                        const councilMember = member as ICouncil;
                        const actions = status.proposal.getActionsForCouncil(councilMember);
                        if (actions) {
                            const memberProposal = await councilMember.addProposal(
                                status.proposal.description,
                                new Map([[councilMember, actions]])
                            );
                            return { council: councilMember, proposal: memberProposal };
                        }
                        return null;
                    }));

                // Store references to track responses
                memberProposals.filter((item): item is { council: ICouncil; proposal: Proposal } => !!item)
                    .forEach(({ council, proposal }) => {
                        if (!this.#pendingResponses.has(council)) {
                            this.#pendingResponses.set(council, new Map());
                        }
                        this.#pendingResponses.get(council)!.set(proposal.description, proposal);
                    });
            } else {
                //console.log(`Proposal "${status.proposal.description}" is not approved.`);
            }
        }
    }

    getMethods() {
        // Get all methods from the prototype
        const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(prop => prop !== 'constructor')
            // @ts-ignore
            .filter(prop => typeof this[prop] === 'function');

        // Get all methods directly on the instance
        const instanceMethods = Object.getOwnPropertyNames(this)
            // @ts-ignore
            .filter(prop => typeof this[prop] === 'function');

        // Combine and deduplicate
        return [...new Set([...prototypeMethods, ...instanceMethods])];
    }
}

export function createCouncil(name: string): ICouncil {
    const council = new Council(name);

    // Define allowed public methods/properties
    const publicInterface = new Set([
        'name',
        'members',
        'delegates',
        'proposals',
        'addProposal',
        'castVote',
        'bootstrap',
        'processProposals',
        'getMethods',
        // 'addMethod', // Exposed in original via explicit addition or logic? 
        // Original has: 'addMethod' in bootstrap, but Council class has addMethod?
        // Original createCouncil publicInterface didn't include addMethod directly, 
        // but bootstrap object returned does. 
        // However, line 370 in original Council defines addMethod. 
        // And createCouncil publicInterface didn't list it. 
        // But wait, the bootstrap returns an object with addMethod. 
        // So we don't need to expose it on the main proxy.
    ]);

    // Actually, let's keep it strictly as original.
    // Original publicInterface:
    /*
    'name',
    'members',
    'delegates',
    'proposals',
    'addProposal',
    'castVote',
    'bootstrap',
    'processProposals',
    'getMethods'
    */

    // Define properties that should be accessed directly (not bound)
    const directProperties = new Set([
        'name',
        'members',
        'delegates',
        'proposals',
        'isExecutingProposal'
    ]);

    // Store the proxy reference to return from internal methods
    const proxy = new Proxy(council, {
        get(target, prop, receiver) {
            // Handle symbol properties
            if (typeof prop === 'symbol') {
                return Reflect.get(target, prop, receiver);
            }

            const stringProp = String(prop);

            // Direct properties should be returned without binding
            if (directProperties.has(stringProp)) {
                return target[stringProp];
            }

            // Public interface methods need binding
            if (publicInterface.has(stringProp)) {
                const value = target[stringProp];
                // For methods that return council references, ensure we return the proxy
                if (typeof value === 'function') {
                    return function (...args: any[]) {
                        const result = value.apply(target, args);
                        // If result is the council itself, return the proxy instead
                        return result === target ? proxy : result;
                    };
                }
                return value;
            }

            // During proposal execution, allow access to ANY method
            if (target['isExecutingProposal']) { // We need to manage isExecutingProposal state
                const value = target[stringProp];
                if (typeof value === 'function') {
                    return function (...args: any[]) {
                        const result = value.apply(target, args);
                        // If result is the council itself, return the proxy instead
                        return result === target ? proxy : result;
                    };
                }
                return value;
            }

            console.log(`Attempted to access restricted method/property: ${stringProp}`);
            return undefined;
        }
    });

    // Modify the council to use its proxy reference
    council.proxyRef = proxy as unknown as ICouncil; // Cast for internal usage

    return proxy as unknown as ICouncil;
}

// Example usage demonstrating the full flow of the system
async function main() {
    // Create councils
    const councilA = createCouncil('Council A');
    const councilB = createCouncil('Council B');

    // Bootstrap phase
    const bootstrapA = councilA.bootstrap(); // Type as any for bootstrap return
    const member1 = bootstrapA.addMember('Member 1');
    const member2 = bootstrapA.addMember('Member 2');
    bootstrapA.addMethod('increaseFunding', function (this: any, amount: number) {
        console.log(`${this.name} increasing funding by ${amount}`);
    });

    const bootstrapB = councilB.bootstrap();
    bootstrapB.addMethod('acceptFunding', function (this: any, amount: number) {
        console.log(`${this.name} accepting funding of ${amount}`);
    });

    // After bootstrap, continue with normal operation
    const mandateDescription = 'Negotiate trade agreement with Council B';
    const mandateActions = new Map();
    mandateActions.set(councilA, {
        description: 'Elect delegate with negotiation powers',
        methodName: 'electDelegate',
        methodArgs: ['Ruzgar', mandateDescription, councilB]
    });

    // Create and add the mandate proposal
    const mandateProposal = councilA.addProposal(mandateDescription, mandateActions);

    // Members vote on the mandate
    member1.castVote(mandateProposal, 'yes');
    member2.castVote(mandateProposal, 'yes');

    // First, process the mandate proposal to create the delegate
    // @ts-ignore
    for await (const status of councilA.processProposals()) {
        console.log('Proposal status:', status);
        if (status.isApproved) {
            //console.log(`Mandate proposal "${status.proposal.description}" is approved.`);
            // Let the processProposals method handle the execution
            // The delegate will be created after this iteration
        }
    }

    // Now that the delegate is created, we can get it and use it
    // @ts-ignore
    const delegates = councilA.delegates;
    console.log('Available delegates after mandate approval:', delegates);

    if (delegates.length > 0) {
        const delegate = delegates[0];
        console.log('Selected delegate:', delegate);

        // Delegate proposes action in Council B
        const proposalActions = new Map();
        proposalActions.set(councilA, {
            description: 'Increase funding for public works',
            methodName: 'increaseFunding',
            methodArgs: [1000]
        });
        proposalActions.set(councilB, {
            description: 'Accept funding increase',
            methodName: 'acceptFunding',
            methodArgs: [1000]
        });

        delegate.propose('Inter-council funding proposal', proposalActions);
    } else {
        console.log('No delegates available after mandate approval');
    }
}

async function testVotingScenarios() {
    console.log('=== Testing Voting Scenarios ===');

    // Test Case 1: Simple Majority
    console.log('\nTest Case 1: Simple Majority');
    const councilA = createCouncil('Council A');
    // @ts-ignore
    const bootstrapA = councilA.bootstrap();
    const member1 = bootstrapA.addMember('Member 1');
    const member2 = bootstrapA.addMember('Member 2');

    const proposal1 = councilA.addProposal('Simple majority test');
    member1.castVote(proposal1, 'yes');
    member2.castVote(proposal1, 'no');

    // @ts-ignore
    for await (const status of councilA.processProposals()) {
        console.log('Status:', status);
    }

    // Test Case 2: Unanimous Approval
    console.log('\nTest Case 2: Unanimous Approval');
    const councilB = createCouncil('Council B');
    // @ts-ignore
    const bootstrapB = councilB.bootstrap();
    const memberB1 = bootstrapB.addMember('Member B1');
    const memberB2 = bootstrapB.addMember('Member B2');
    const memberB3 = bootstrapB.addMember('Member B3');

    const proposal2 = councilB.addProposal('Unanimous test');
    memberB1.castVote(proposal2, 'yes');
    memberB2.castVote(proposal2, 'yes');
    memberB3.castVote(proposal2, 'yes');

    // @ts-ignore
    for await (const status of councilB.processProposals()) {
        console.log('Status:', status);
    }
}

// If this file is run directly
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
    testVotingScenarios().catch(console.error);
}
