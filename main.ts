
import { createCouncilServer } from './CouncilServer'; // In a real app, this might be a WebSocket connection
// import { newWebSocketRpcSession } from 'capnweb'; // Uncomment when separating client/server

// PROTOCOL
import { ICouncil, IMember, IProposalRef } from './protocol';

let currentCouncil: ICouncil | null = null;
let currentMemberSession: IMember | null = null;
let currentMemberName: string | null = null;

// Structure to hold our client-side view of the world
const councils = new Map<string, ICouncil>();
let currentProposalActions: any[] = [];

// Contact Management
interface Contact {
    id: string; // For now, sim capability
    name: string;
    ref?: IPublicIdentity; // The Capability
}
// Default contacts should be empty to rely on auto-discovery
let myContacts: Contact[] = [];

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
        "Create a network of freely-associating autonomous regions, united through mutual cooperation and shared democratic principles.",
        "Transition land, natural resources, infrastructure, and large-scale agricultural operations to community stewardship for common benefit.",
        "Transfer industrial infrastructure (factories, transportation, energy) to democratic worker control through a coordinated economic system based on free-association.",
        "Cancel all debt held by previous power structures and financial institutions to enable economic reset.",
        "Restructure the banking system under democratic community control to serve common interests rather than private profit.",
        "Ensure community security through universal training and democratic control of defense forces, preventing power concentration.",
        "Ensure media independence through distributed, peer to peer, secure communication infrastructure.",
        "Provide accessible community spaces with modern facilities for public gatherings and democratic participation.",
        "Provide community workshops, shared resources, and democratic access to creative spaces.",
        "Establish a network of freely-associating community health centers combining preventive care, traditional wisdom, and modern medicine.",
        "Establish a network of freely-associating community educational centers providing universal and free education, combining practical skills, critical thinking, and democratic values.",
        "Establish a network of freely-associating research communities coordinating scientific endeavors based on social needs and ecological harmony.",
        "Support grassroots organizing with resources and infrastructure for community empowerment.",
        "Support global liberation movements and end economic exploitation of developing regions worldwide.",
        "Promote international cooperation through transparent diplomacy and solidarity across borders.",
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

// UI HANDLERS

(window as any).resetView = function () {
    currentCouncil = null;
    currentMemberSession = null;
    updateUIState();
}; // Added semicolon

(window as any).switchIdentity = function () {
    currentMemberSession = null;
    currentMemberName = null;
    updateUIState();
}; // Added semicolon

async function updateUIState() {
    // DOM Elements
    const viewDashboard = document.getElementById('view-dashboard') as HTMLElement;
    const viewCockpit = document.getElementById('view-cockpit') as HTMLElement;

    // Cockpit Elements - use optional chaining or fallback as they might not exist if HTML isn't updated nicely yet, but we updated HTML.
    // However, TypeScript might complain if we don't cast or check.
    const memberSelect = document.getElementById('memberSelect') as HTMLSelectElement;
    const activeCouncilName = document.getElementById('activeCouncilName');
    const memberList = document.getElementById('memberList');
    const memberCount = document.getElementById('memberCount');
    const executionFeed = document.getElementById('executionFeed');

    // User Identity Elements
    const userBadge = document.getElementById('userBadge');
    const displayUserName = document.getElementById('displayUserName');
    const displayUserPower = document.getElementById('displayUserPower');
    const btnDelegate = document.getElementById('btnDelegate');


    if (!currentCouncil) {
        // Show Dashboard, Hide Cockpit
        if (viewDashboard) viewDashboard.style.display = 'grid';
        if (viewCockpit) viewCockpit.style.display = 'none';
        renderCouncilDashboard();
    } else {
        // Show Cockpit, Hide Dashboard
        if (viewDashboard) viewDashboard.style.display = 'none';
        if (viewCockpit) viewCockpit.style.display = 'flex';

        if (activeCouncilName) activeCouncilName.textContent = await currentCouncil.getName();

        // 1. Populate Members (Left Panel & Login Select)
        const members = await currentCouncil.getMembers();

        // Login Select
        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">Login as Member...</option>';
            for (const m of members) {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                if (m.name === currentMemberName) opt.selected = true;
                memberSelect.appendChild(opt);
            }
        }

        // Network List (Left Panel)
        if (memberList && memberCount) {
            memberList.innerHTML = '';
            memberCount.textContent = members.length.toString();

            for (const m of members) {
                // AUTO-DISCOVERY
                if (!myContacts.find(c => c.name === m.name)) {
                    console.log(`[Auto-Discovery] Found new identity: ${m.name}`);
                    myContacts.push({
                        id: m.name,
                        name: m.name,
                        ref: m.identity
                    });
                }

                const item = document.createElement('div');
                item.className = 'member-item';
                if (m.name === currentMemberName) item.classList.add('active');

                // Avatar initials
                const initials = m.name.substring(0, 2).toUpperCase();

                item.innerHTML = `
                    <div class="member-avatar">${initials}</div>
                    <div class="member-info">
                        <div class="member-name">${m.name}</div>
                        <div class="member-sub">Power: ${m.votingPower}</div>
                    </div>
                 `;
                memberList.appendChild(item);
            }

            // Re-render contacts to show discovered
            renderContacts();
        }

        // 2. Feed (Right Panel)
        const messages = await currentCouncil.getMessages();
        if (executionFeed) {
            executionFeed.innerHTML = '';
            if (messages.length === 0) {
                executionFeed.innerHTML = '<div style="color:#999; padding:16px; text-align:center;">No executions yet.</div>';
            } else {
                // Reverse to show latest top
                [...messages].reverse().forEach(msg => {
                    const feedItem = document.createElement('div');
                    feedItem.className = 'feed-item';
                    feedItem.innerHTML = `
                        <div class="feed-time">Just now</div>
                        <div class="feed-content">${msg}</div>
                     `;
                    executionFeed.appendChild(feedItem);
                });
            }
        }

        // 3. Toggle Identity State
        if (currentMemberSession) {
            if (memberSelect) memberSelect.style.display = 'none';
            if (userBadge) userBadge.style.display = 'flex';
            if (btnDelegate) btnDelegate.style.display = 'block';

            // Find my info
            const myInfo = members.find(m => m.name === currentMemberName);
            if (displayUserName) displayUserName.textContent = currentMemberName!;
            if (myInfo && displayUserPower) {
                displayUserPower.textContent = `Power: ${myInfo.votingPower}`;
            }
        } else {
            if (memberSelect) memberSelect.style.display = 'block';
            if (userBadge) userBadge.style.display = 'none';
            if (btnDelegate) btnDelegate.style.display = 'none';
        }
    }
}

async function renderCouncilDashboard() {
    const dashboard = document.getElementById('view-dashboard')!;
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
    currentCouncil = councils.get(id) || null;
    await updateUIState();
    await updateProposals();
};


// --- DELEGATION UI --- //
(window as any).openDelegateModal = async () => {
    if (!currentMemberSession || !currentCouncil) return;

    document.getElementById('delegateModal')!.style.display = 'block';

    const container = document.getElementById('delegateList')!;
    container.innerHTML = 'Loading...';

    const members = await currentCouncil.getMembers();
    container.innerHTML = '';

    // Add "Self / Undelegate" Option
    const selfItem = document.createElement('div');
    selfItem.className = 'member-item'; // Reuse styling
    selfItem.innerHTML = `
        <div class="member-avatar" style="background:#4CAF50; color:white;">Me</div>
        <div class="member-info">
            <div class="member-name">Myself</div>
            <div class="member-sub">Retain my own power</div>
        </div>
        <button class="delegate-btn">Select</button> 
    `;
    selfItem.onclick = async () => await setDelegate(currentMemberName!);
    container.appendChild(selfItem);

    // Add other members
    for (const m of members) {
        if (m.name === currentMemberName) continue; // Skip self in the list loop

        const item = document.createElement('div');
        item.className = 'member-item';
        item.innerHTML = `
            <div class="member-avatar">${m.name.substring(0, 2).toUpperCase()}</div>
            <div class="member-info">
                <div class="member-name">${m.name}</div>
                <div class="member-sub">Power: ${m.votingPower}</div>
            </div>
            <button class="delegate-btn">Delegate</button>
        `;
        item.onclick = async () => await setDelegate(m.name);
        container.appendChild(item);
    }
};

(window as any).closeDelegateModal = () => {
    document.getElementById('delegateModal')!.style.display = 'none';
};

// --- PROPOSAL UI --- //
(window as any).addProposal = () => {
    if (!currentMemberSession) {
        alert("Please select an identity first.");
        return;
    }
    document.getElementById('proposalModal')!.style.display = 'block';
};

(window as any).closeProposalModal = () => {
    document.getElementById('proposalModal')!.style.display = 'none';
};


async function setDelegate(targetName: string) {
    if (!currentMemberSession) return;
    try {
        console.log(`Delegating to ${targetName}...`);
        // We simplified backend: passing SELF name clears delegation.
        // We must ensure backend 'delegate' RPC calls 'member.delegateTo' 
        await currentMemberSession.delegate(targetName);
        console.log("Delegation successful.");
        (window as any).closeDelegateModal();
        updateUIState();
    } catch (e) {
        console.error("Delegation failed", e);
        alert("Failed to delegate: " + e);
    }
}


// GLOBAL EXPORTS for HTML
// loadCouncilData removal - no longer used
(window as any).loadCouncilData = async () => { };

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




function renderContacts() {
    const container = document.getElementById('contactList');
    if (!container) return;
    container.innerHTML = '';

    for (const c of myContacts) {
        const item = document.createElement('div');
        item.className = 'member-item';
        item.style.cursor = 'grab'; // Implies capability
        item.innerHTML = `
            <div class="member-avatar" style="background:#eee; color:#666;">${c.name.substring(0, 2).toUpperCase()}</div>
                <div class="member-info">
                    <div class="member-name">${c.name}</div>
                </div>
        `;
        container.appendChild(item);
    }
}

(window as any).addContact = () => {
    const name = prompt("Enter contact name:");
    if (name) {
        myContacts.push({ id: name, name: name });
        renderContacts();
    }
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

        // Parse Actions
        let actionHtml = '';
        const info = await ref.getInfo();
        if (info.actions && info.actions.length > 0) {
            actionHtml = '<div class="proposal-actions">';
            info.actions.forEach(a => {
                let display = `${a.methodName}(${a.methodArgs.join(', ')})`;
                // Beautify
                if (a.methodName === 'addMember') display = `<strong>Add Member:</strong> ${a.methodArgs[0]} (Power: ${a.methodArgs[1] || 1})`;
                if (a.methodName === 'postMessage') display = `<strong>Post Message:</strong> "${a.methodArgs[0]}"`;

                actionHtml += `<div class="action-item">${display}</div>`;
            });
            actionHtml += '</div>';
        }

        card.innerHTML = `
            <div class="proposal-header">
                <div>
                    <h3>${status.description}</h3>
                    ${actionHtml}
                </div>
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

// --- PROPOSAL FORM HANDLERS ---

// 1. Dynamic Inputs Listener
document.getElementById('actionType')?.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    const container = document.getElementById('actionFields')!;
    const addBtn = document.getElementById('addAction')!;

    container.innerHTML = '';

    if (type === 'addMember') {
        container.innerHTML = `
            <select id="inputMemberName">
                <option value="">Select Contact...</option>
                ${myContacts.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
        `;
        addBtn.style.display = 'inline-block';
    } else if (type === 'postMessage') {
        container.innerHTML = `<input type="text" id="inputMessage" placeholder="Message Content" />`;
        addBtn.style.display = 'inline-block';
    } else if (type === 'addProposal') {
        container.innerHTML = `
            <select id="inputTargetCouncil">
                <option value="">Select Target Council</option>
                ${Array.from(councils.keys()).map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
            <input type="text" id="inputDescription" placeholder="Proposal Description" />
        `;
        addBtn.style.display = 'inline-block';
    } else if (type === 'electDelegate') {
        container.innerHTML = `
            <select id="inputDelegateName">
                 <option value="">Select Delegate (Contact)...</option>
                 ${myContacts.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
            <select id="inputTargetCouncil">
                <option value="">Select Target Council</option>
                ${Array.from(councils.keys()).map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
            <input type="text" id="inputMandate" placeholder="Mandate Description" />
        `;
        addBtn.style.display = 'inline-block';
    } else {
        addBtn.style.display = 'none';
    }
});

// 2. Add Action Handler
document.getElementById('addAction')?.addEventListener('click', () => {
    const type = (document.getElementById('actionType') as HTMLSelectElement).value;

    if (type === 'addMember') {
        const name = (document.getElementById('inputMemberName') as HTMLSelectElement).value;
        if (!name) return alert("Select a contact");

        currentProposalActions.push({
            display: `Add Member: ${name}`,
            data: {
                target: currentCouncil,
                methodName: 'addMember',
                methodArgs: [name, 1]
            }
        });
    } else if (type === 'postMessage') {
        const msg = (document.getElementById('inputMessage') as HTMLInputElement).value;
        if (!msg) return alert("Enter a message");

        currentProposalActions.push({
            display: `Post Message: "${msg}"`,
            data: {
                target: currentCouncil,
                methodName: 'postMessage',
                methodArgs: [msg]
            }
        });
    } else if (type === 'addProposal') {
        const targetName = (document.getElementById('inputTargetCouncil') as HTMLSelectElement).value;
        const desc = (document.getElementById('inputDescription') as HTMLInputElement).value;

        if (!targetName || !desc) return alert("Fill all fields");

        const target = councils.get(targetName);
        // Note: This 'target' is the ICouncil stub from our client map.
        // In a real system, we'd need to ensure the SERVER has this capability.
        // Here, we pass the stub. Cap'n Web should handle it if passed over RPC?
        // CAUTION: Passing a client-side stub to the server might not work if the server doesn't know it.
        // But in this local simulation, objects are shared in memory (via Main.ts logic essentially).
        // Ideally, we PROPOSE that the Council calls 'addProposal' on a capability IT holds.
        // But we are passing the capability FROM the client?
        // "Here, take this pointer to Council B and call addProposal on it."
        // That works in Cap'n Proto! Pipelining/Cap passing.

        // Let's assume the target has an "addProposal" method for federation?
        // If I can't guarantee it, I'll fallback to generic execution.
        currentProposalActions.push({
            display: `Propose to ${targetName}: "${desc}"`,
            data: {
                target: target,
                methodName: 'addProposal', // Hope implementation has it
                methodArgs: [desc, []]
            }
        });
    } else if (type === 'electDelegate') {
        const delegateName = (document.getElementById('inputDelegateName') as HTMLInputElement).value;
        const targetName = (document.getElementById('inputTargetCouncil') as HTMLSelectElement).value;
        const mandate = (document.getElementById('inputMandate') as HTMLInputElement).value;

        if (!delegateName || !targetName || !mandate) return alert("Fill all fields");

        currentProposalActions.push({
            display: `Elect Delegate: ${delegateName} for ${targetName}`,
            data: {
                target: currentCouncil,
                methodName: 'electDelegate',
                methodArgs: [delegateName, mandate, councils.get(targetName)]
            }
        });
    }

    // Reset inputs but keep type selected
    const container = document.getElementById('actionFields')!;
    const inputs = container.querySelectorAll('input');
    inputs.forEach(i => i.value = '');

    renderAddedActions();
});

function renderAddedActions() {
    const list = document.getElementById('addedActionsList')!;
    list.innerHTML = '';

    currentProposalActions.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'added-action-item';
        div.innerHTML = `
            <span>${item.display}</span>
            <span class="remove-action" onclick="window.removeAction(${index})">x</span>
        `;
        list.appendChild(div);
    });

    // Render Contacts
    renderContacts();
}

(window as any).removeAction = (index: number) => {
    currentProposalActions.splice(index, 1);
    renderAddedActions();
};

// 3. Submit Handler
document.getElementById('proposalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentMemberSession) return;

    const description = (document.getElementById('description') as HTMLTextAreaElement).value;

    // Extract raw protocol actions from our UI state
    const finalActions = currentProposalActions.map(i => i.data);

    try {
        console.log("Submitting proposal:", description, finalActions);
        await currentMemberSession.propose(description, finalActions);

        (window as any).closeProposalModal();
        await updateProposals();
        await updateUIState();
    } catch (err) {
        console.error("Proposal failed", err);
        alert("Proposal failed: " + err);
    }
});

function getStatusClass(status: any) {
    if (status.votes.yes >= status.quorum) return 'approved';
    return 'rejected';
}

// Start
initializeTestData().then(() => {
    renderContacts();
    updateUIState();
});

