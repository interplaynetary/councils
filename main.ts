
import { createCouncilServer } from './CouncilServer'; // In a real app, this might be a WebSocket connection
// import { newWebSocketRpcSession } from 'capnweb'; // Uncomment when separating client/server

// PROTOCOL
import { ICouncil, IMember, IProposalRef } from './protocol';

let currentCouncil: ICouncil | null = null;
let currentMemberSession: IMember | null = null;
let currentMemberName: string | null = null;

// Structure to hold our client-side view of the world
const councils = new Map<string, ICouncil>();

// We also need to track the "server" instances so we can bootstrap them locally
// In a real distributed system, we wouldn't have access to these, just the ICouncil stubs.
const serverInstances = new Map<string, any>();

async function initializeTestData() {
    console.log("Initializing Distributed Council Test Data...");

    // Create servers (Simulating remote nodes)
    const serverA = createCouncilServer('Workers Council');
    const serverB = createCouncilServer('Farmers Council');

    // Store them (locally simulation)
    // We treat them as ICouncil interfaces from here on
    councils.set('councilA', serverA);
    councils.set('councilB', serverB);

    serverInstances.set('councilA', serverA); // Keep ref for strict local debugging if needed
    serverInstances.set('councilB', serverB);

    // Bootstrap Data via RPC calls!
    // 1. Join and create members
    const aliceSession = await serverA.join('Worker 1 (Alice)');
    const bobSession = await serverA.join('Worker 2 (Bob)');
    await serverA.join('Worker 3 (Charlie)');

    const farmerSession = await serverB.join('Farmer 1');
    await serverB.join('Farmer 2');

    // 2. Create Constitutional Proposals via Alice
    const proposals = [
        "Create a network of freely-associating autonomous regions",
        "Transition land to community stewardship"
    ];

    for (const desc of proposals) {
        await aliceSession.propose(desc, []);
    }

    // NEW: Real Execution Verification Proposal
    // AUTOMATIC SECURITY: We just pass the capability. The SERVER wraps it in a revocable proxy upon proposal creation.
    await aliceSession.propose("Send Greetings to Farmers Council", [
        {
            description: "Post a message to the Farmers Council feed",
            methodName: 'postMessage',
            methodArgs: ['Hello from the Workers Council! We stand in solidarity.'],
            target: serverB // PASSING THE CAPABILITY DIRECTLY!
        }
    ]);

    const farmerProposals = [
        "Transition large-scale monoculture to permaculture food forests",
        "Establish local seed banks and coordinate planting cycles"
    ];

    for (const desc of farmerProposals) {
        await farmerSession.propose(desc, []);
    }

    // 4. Security Verification: Revocation
    console.log("--- Security Verification: Revoking Malory ---");
    const malorySession = await serverA.join('Malory');

    // Revoke!
    serverA.revokeMember('Malory');

    try {
        await malorySession.propose("I am still here", []);
        console.error("SECURITY FAIL: Malory could still propose!");
    } catch (e) {
        console.log("SECURITY SUCCESS: Malory's session is revoked.", e);
    }
    console.log("----------------------------------------------");

    // 3. Bob votes on them
    const proposalRefs = await serverA.getProposals();
    for (const ref of proposalRefs) {
        await bobSession.vote(ref, 'yes');
    }
}

// UI HANDLERS

async function initializeCouncils() {
    const select = document.getElementById('councilSelect') as HTMLSelectElement;
    select.innerHTML = '<option value="">Select Council</option>';

    for (const [id, council] of councils.entries()) {
        const name = await council.getName(); // RPC call
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        select.appendChild(option);
    }
}

(window as any).resetView = function () {
    currentCouncil = null;
    currentMemberSession = null;
    updateUIState();
}

async function updateUIState() {
    const dashboard = document.getElementById('council-dashboard') as HTMLElement;
    const proposals = document.getElementById('proposals') as HTMLElement;
    const memberSelect = document.getElementById('memberSelect') as HTMLSelectElement;

    if (!currentCouncil) {
        dashboard.style.display = 'grid';
        proposals.style.display = 'none';
        renderCouncilDashboard();
    } else {
        dashboard.style.display = 'none';
        proposals.style.display = 'grid';

        // Populate members via RPC (Honest Discovery)
        const members = await currentCouncil.getMembers();
        memberSelect.innerHTML = '<option value="">Select Identity</option>';

        for (const m of members) {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = `${m.name} (Power: ${m.votingPower})`;
            if (m.name === currentMemberName) opt.selected = true;
            memberSelect.appendChild(opt);
        }
    }
}

async function renderCouncilDashboard() {
    const dashboard = document.getElementById('council-dashboard')!;
    dashboard.innerHTML = '';

    for (const [id, council] of councils.entries()) {
        const name = await council.getName();
        // Honest discovery mechanics
        const members = await council.getMembers();
        const messages = await council.getMessages();

        const card = document.createElement('div');
        card.className = 'council-summary-card';
        card.onclick = () => (window as any).selectCouncilFromDashboard(id);

        const msgHtml = messages.length > 0
            ? `<div class="messages"><strong>Latest:</strong> ${messages[messages.length - 1]}</div>`
            : `<div class="messages"><em>No public messages</em></div>`;

        card.innerHTML = `
            <h3>${name}</h3>
            <div class="council-stats">
               <div>${members.length} Members</div>
               ${msgHtml}
            </div>
        `;
        dashboard.appendChild(card);
    }
}

(window as any).selectCouncilFromDashboard = async function (id: string) {
    const select = document.getElementById('councilSelect') as HTMLSelectElement;
    select.value = id;
    currentCouncil = councils.get(id) || null;
    await updateUIState();
    await updateProposals();
};


// GLOBAL EXPORTS for HTML
(window as any).loadCouncilData = async () => {
    const id = (document.getElementById('councilSelect') as HTMLSelectElement).value;
    if (!id) {
        (window as any).resetView();
        return;
    }
    currentCouncil = councils.get(id) || null;
    await updateUIState();
    await updateProposals();
};

(window as any).selectMember = async () => {
    const name = (document.getElementById('memberSelect') as HTMLSelectElement).value;
    if (!name || !currentCouncil) return;

    // "Login" - get the capability
    console.log(`Logging in as ${name}...`);
    currentMemberSession = await currentCouncil.join(name);
    currentMemberName = name;

    // Now we are authenticated for actions!
    updateUIState();
    updateProposals(); // re-render to show correct voting status
};


async function updateProposals() {
    const container = document.getElementById('proposals');
    if (!container || !currentCouncil) return;
    container.innerHTML = '';

    const proposalRefs = await currentCouncil.getProposals();

    for (const ref of proposalRefs) {
        // Parallelize fetching info
        const status = await ref.getStatus();

        let myVote: 'yes' | 'no' | undefined = undefined;
        if (currentMemberSession) {
            myVote = await currentMemberSession.getVote(ref);
        }

        const card = document.createElement('div');
        const votedClass = myVote ? `voted-${myVote}` : '';
        card.className = `proposal-card ${getStatusClass(status)} ${votedClass}`;

        card.innerHTML = `
            <div class="proposal-header">
                <h3>${status.description}</h3>
                <label class="toggle-switch">
                    <input type="checkbox" data-desc="${status.description}" ${myVote === 'yes' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="stats">
               Yes: ${status.votes.yes} | No: ${status.votes.no} | Quorum: ${status.quorum}
            </div>
        `;

        // Add listener using the Reference capability!
        const checkbox = card.querySelector('input');
        if (checkbox) {
            checkbox.onclick = async (e) => {
                if (!currentMemberSession) {
                    alert("Select an identity first!");
                    e.preventDefault();
                    return;
                }
                const vote = checkbox.checked ? 'yes' : 'no';
                console.log(`Voting ${vote} on ${status.description}`);

                try {
                    // WE USE THE CAPABILITY TO VOTE
                    await currentMemberSession.vote(ref, vote);
                    console.log("Vote successful!");
                    // Optimistic UI update or reload
                    updateProposals();
                } catch (e: any) {
                    console.error("Vote failed", e);
                    alert("Vote failed!");
                    e.preventDefault();
                }
            };
        }

        container.appendChild(card);
    }
}

function getStatusClass(status: any) {
    if (status.votes.yes >= status.quorum) return 'approved';
    return 'rejected';
}

// Start
initializeTestData().then(() => {
    initializeCouncils();
    updateUIState();
});

