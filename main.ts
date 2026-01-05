
import { createCouncil } from './Council';

let currentCouncil: any = null;
let currentMember: any = null;
let councils = new Map();
let proposalActions: any[] = [];

// Initialize with some test councils
async function initializeTestData() {
    // Create test councils
    const councilA = createCouncil('Workers Council');
    const councilB = createCouncil('Farmers Council');

    // Bootstrap councils
    const bootstrapA = councilA.bootstrap();
    const member1 = bootstrapA.addMember('Worker 1');
    const member2 = bootstrapA.addMember('Worker 2');
    const member3 = bootstrapA.addMember('Worker 3');

    const bootstrapB = councilB.bootstrap();
    const memberB1 = bootstrapB.addMember('Farmer 1');
    const memberB2 = bootstrapB.addMember('Farmer 2');

    // Store councils with their members
    councils.set('councilA', {
        council: councilA,
        members: [member1, member2, member3]
    });
    councils.set('councilB', {
        council: councilB,
        members: [memberB1, memberB2]
    });

    // Add constitutional proposals
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

    // Add proposals to Workers Council
    proposals.forEach(proposal => {
        councilA.addProposal(proposal);
    });

    // Add relevant agricultural proposals to Farmers Council
    const farmerProposals = proposals.filter(p =>
        p.toLowerCase().includes('farm') ||
        p.toLowerCase().includes('land') ||
        p.toLowerCase().includes('agricultur')
    );

    farmerProposals.forEach(proposal => {
        councilB.addProposal(proposal);
    });
}

async function getCouncil(councilId: string) {
    const data = councils.get(councilId);
    if (data) {
        if (!currentMember) {
            currentMember = data.members[0]; // Only set first member if no member is selected
        }
        return data.council;
    }
    return null;
}

// Initialize councils dropdown
function initializeCouncils() {
    const select = document.getElementById('councilSelect') as HTMLSelectElement;
    select.innerHTML = '<option value="">Select Council</option>';

    for (const [id, data] of councils.entries()) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = data.council.name;
        if (data.council === currentCouncil) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function updateUIState() {
    const memberSelect = document.getElementById('memberSelect') as HTMLSelectElement;
    const hasValidMember = memberSelect.value !== '';
    const dashboard = document.getElementById('council-dashboard') as HTMLElement;
    const proposals = document.getElementById('proposals') as HTMLElement;
    const addBtn = document.querySelector('.add-proposal') as HTMLElement;

    if (!currentCouncil) {
        // Show dashboard, hide proposals
        dashboard.style.display = 'grid';
        proposals.style.display = 'none';
        addBtn.style.display = 'none';
        renderCouncilDashboard();
    } else if (!hasValidMember) {
        // Council selected but no member: hide everything except header controls
        dashboard.style.display = 'none';
        proposals.style.display = 'none';
        addBtn.style.display = 'none';
    } else {
        // Show proposals
        dashboard.style.display = 'none';
        proposals.style.display = 'grid'; // grid as per css
        addBtn.style.display = 'flex'; // flex as per css
    }
}

function renderCouncilDashboard() {
    const dashboard = document.getElementById('council-dashboard')!;
    dashboard.innerHTML = '';

    for (const [id, data] of councils.entries()) {
        const card = document.createElement('div');
        card.className = 'council-summary-card';
        card.onclick = () => (window as any).selectCouncilFromDashboard(id);

        card.innerHTML = `
            <h3>${data.council.name}</h3>
            <div class="council-stats">
                <div class="stat-row">
                    <span class="stat-label">Members</span>
                    <span class="stat-value">${data.members.length}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Proposals</span>
                    <span class="stat-value">${data.council.proposals.length}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Delegates</span>
                    <span class="stat-value">${data.council.delegates.length}</span>
                </div>
            </div>
        `;
        dashboard.appendChild(card);
    }
}

(window as any).selectCouncilFromDashboard = function (councilId: string) {
    const select = document.getElementById('councilSelect') as HTMLSelectElement;
    select.value = councilId;
    loadCouncilData();
};

async function loadCouncilData() {
    const councilId = (document.getElementById('councilSelect') as HTMLSelectElement).value;
    if (!councilId) {
        currentCouncil = null;
        currentMember = null;
        updateUIState();
        return;
    }

    currentCouncil = await getCouncil(councilId);

    // Update member dropdown
    const memberSelect = document.getElementById('memberSelect') as HTMLSelectElement;
    memberSelect.innerHTML = '<option value="">Select Member</option>';

    const councilData = councils.get(councilId);
    councilData.members.forEach((member: any, index: number) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = member.name;
        if (member === currentMember) {
            option.selected = true;
        }
        memberSelect.appendChild(option);
    });

    updateUIState();
    await updateProposals();
}

function selectMember() {
    const councilId = (document.getElementById('councilSelect') as HTMLSelectElement).value;
    const memberIndex = (document.getElementById('memberSelect') as HTMLSelectElement).value;

    if (councilId && memberIndex !== '') {
        const councilData = councils.get(councilId);
        currentMember = councilData.members[parseInt(memberIndex)];

        // Update the member dropdown to reflect the current selection
        const memberSelect = document.getElementById('memberSelect') as HTMLSelectElement;
        Array.from(memberSelect.options).forEach(option => {
            option.selected = option.value === memberIndex;
        });
    } else {
        currentMember = null;
    }

    updateUIState();
    if (currentMember) {
        updateProposals();
    }
}

async function updateProposals() {
    const proposalsContainer = document.getElementById('proposals');
    if (!proposalsContainer) return;
    proposalsContainer.innerHTML = '';

    if (!currentCouncil) return;

    try {
        for await (const status of currentCouncil.processProposals()) {
            const card = createProposalCard(status);
            proposalsContainer.appendChild(card);
        }
    } catch (error) {
        console.error('Error processing proposals:', error);
    }
}

function createProposalCard(status: any) {
    const card = document.createElement('div');

    // Check if current member has voted
    const currentVote = Array.from((status.proposal.votes as Map<any, string>).entries())
        .find(([voter, _]) => voter === currentMember)?.[1];

    // Set classes based on vote status
    const votedClass = currentVote ? `voted-${currentVote}` : '';
    card.className = `proposal-card ${getStatusClass(status)} ${votedClass}`;

    // Format actions for display
    let actionsHtml = '';
    if (status.proposal.actions && status.proposal.actions.size > 0) {
        const actionItems = Array.from((status.proposal.actions as Map<any, any>).entries())
            .map(([council, action]) => `
                <div class="action-item">
                    <span class="action-target">${council.name}</span>
                    <span class="action-method">${action.methodName}</span>
                    <span class="action-args">${action.methodArgs.join(', ')}</span>
                </div>
            `).join('');

        actionsHtml = `
            <div class="proposal-actions">
                <h4>Actions:</h4>
                ${actionItems}
            </div>
        `;
    }

    card.innerHTML = `
        <div class="proposal-header">
            <h3>${status.description}</h3>
            <label class="toggle-switch">
                <input type="checkbox" 
                       data-proposal="${status.description}"
                       ${currentVote === 'yes' ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        ${actionsHtml}
    `;

    // Update the click handler
    card.addEventListener('click', async (e: any) => {
        // Don't handle clicks on action items
        if (e.target.closest('.action-item')) return;

        const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const newVote = checkbox.checked ? 'no' : 'yes';  // Toggle between yes/no
        checkbox.checked = newVote === 'yes';             // Update checkbox based on vote

        // Update the voted class immediately for visual feedback
        card.className = `proposal-card ${getStatusClass(status)} voted-${newVote}`;

        await handleVoteChange({
            target: {
                dataset: { proposal: status.description },
                checked: newVote === 'yes'
            },
            type: 'change'
        });
    });

    return card;
}

function getStatusClass(status: any) {
    // Calculate total votes
    // const totalVotes = status.votes.yes + status.votes.no;

    // A proposal is approved if yes votes exceed 50% of total voting power
    if (status.votes.yes >= status.quorum) {
        return 'approved';
    } else {
        return 'rejected';  // Default to rejected instead of pending
    }
}

async function handleVoteChange(event: any) {
    const proposalId = event.target.dataset.proposal;
    const vote = event.target.checked ? 'yes' : 'no';
    console.log(`Attempting to vote ${vote} on proposal: ${proposalId}`);
    await castVote(proposalId, vote);
}

async function castVote(proposalId: string, vote: string) {
    if (!currentCouncil || !currentMember) {
        console.log('Missing council or member:', { council: !!currentCouncil, member: !!currentMember });
        return;
    }

    try {
        // Find the proposal by description
        const proposal = currentCouncil.proposals.find((p: any) => p.description === proposalId);
        if (!proposal) {
            console.error('Proposal not found:', proposalId);
            return;
        }

        // Use the council's castVote method
        currentCouncil.castVote(currentMember, proposal, vote);
        console.log(`Vote cast successfully: ${vote}`);
        await updateProposals();
    } catch (error) {
        console.error('Error casting vote:', error);
    }
}

async function addProposal() {
    if (!currentCouncil) {
        alert('Please select a council first');
        return;
    }
    showProposalModal();
}

function showProposalModal() {
    (document.getElementById('proposalModal') as HTMLElement).style.display = 'block';
}

function closeProposalModal() {
    (document.getElementById('proposalModal') as HTMLElement).style.display = 'none';
    (document.getElementById('proposalForm') as HTMLFormElement).reset();
    (document.getElementById('actionFields') as HTMLElement).innerHTML = '';
    proposalActions = [];  // Clear any added actions
    updateActionsList();   // Clear the actions list display
}

function updateActionFields(actionType: string) {
    const actionFields = document.getElementById('actionFields') as HTMLElement;
    actionFields.innerHTML = '';
    actionFields.className = actionType ? '' : 'hidden';

    switch (actionType) {
        case 'addMember':
            actionFields.innerHTML = `
                <input type="text" placeholder="Member Name" required>
            `;
            break;
        case 'electDelegate':
            actionFields.innerHTML = `
                <input type="text" placeholder="Delegate Name" required>
                <input type="text" placeholder="Mandate Description" required>
                <select id="targetCouncil" required>
                    <option value="">Select Target Council</option>
                    ${Array.from(councils.entries()).map(([id, data]: [any, any]) =>
                `<option value="${id}">${data.council.name}</option>`
            ).join('')}
                </select>
            `;
            break;
        case 'addProposal':
            actionFields.innerHTML = `
                <input type="text" placeholder="Proposal Description" required>
            `;
            break;
        case 'castVote':
            actionFields.innerHTML = `
                <select required>
                    <option value="">Select Decision</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            `;
            break;
    }
}

// Add event listeners
document.getElementById('actionType')?.addEventListener('change', (e: any) => {
    updateActionFields(e.target.value);
});

document.getElementById('addAction')?.addEventListener('click', () => {
    const actionType = (document.getElementById('actionType') as HTMLSelectElement).value;
    if (!actionType) return;

    // Save current action fields before adding new ones
    const fields = document.getElementById('actionFields') as HTMLElement;
    const actionData = collectActionData(actionType, fields);
    if (actionData) {
        proposalActions.push({ type: actionType, ...actionData });
        // Clear the fields for next action
        (document.getElementById('actionType') as HTMLSelectElement).value = '';
        fields.innerHTML = '';
        fields.className = 'hidden';

        // Show added actions
        updateActionsList();
    }
});

document.getElementById('proposalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = (document.getElementById('description') as HTMLTextAreaElement).value;

    // Create actions map from collected actions
    const actions = new Map();
    proposalActions.forEach(action => {
        actions.set(currentCouncil, {
            description: description,
            methodName: action.methodName,
            methodArgs: action.methodArgs
        });
    });

    // Add the proposal
    currentCouncil.addProposal(description, actions);
    await updateProposals();

    // Reset the form and actions
    proposalActions = [];
    closeProposalModal();
});

// Helper to collect action data
function collectActionData(type: string, fields: HTMLElement) {
    switch (type) {
        case 'addMember':
            return {
                memberName: (fields.querySelector('input[placeholder="Member Name"]') as HTMLInputElement).value,
                methodName: 'addMember',
                methodArgs: [(fields.querySelector('input[placeholder="Member Name"]') as HTMLInputElement).value]
            };
        case 'electDelegate':
            return {
                delegateName: (fields.querySelector('input[placeholder="Delegate Name"]') as HTMLInputElement).value,
                mandateDescription: (fields.querySelector('input[placeholder="Mandate Description"]') as HTMLInputElement).value,
                targetCouncil: (fields.querySelector('#targetCouncil') as HTMLSelectElement).value,
                methodName: 'electDelegate',
                methodArgs: [
                    (fields.querySelector('input[placeholder="Delegate Name"]') as HTMLInputElement).value,
                    (fields.querySelector('input[placeholder="Mandate Description"]') as HTMLInputElement).value,
                    councils.get((fields.querySelector('#targetCouncil') as HTMLSelectElement).value).council
                ]
            };
        // Add other action types as needed
        default:
            return null;
    }
}

// Add this function to show added actions
function updateActionsList() {
    const list = document.createElement('div');
    list.className = 'added-actions';
    list.innerHTML = proposalActions.map((action, index) => `
        <div class="action-item">
            <span class="action-target">${currentCouncil.name}</span>
            <span class="action-method">${action.methodName}</span>
            <span class="action-args">${action.methodArgs.join(', ')}</span>
            <button type="button" onclick="(window as any).removeAction(${index})">×</button>
        </div>
    `).join('');

    const actionsContainer = document.querySelector('.action-inputs');
    if (!actionsContainer) return;
    const existingList = actionsContainer.querySelector('.added-actions');
    if (existingList) {
        actionsContainer.replaceChild(list, existingList);
    } else {
        const addBtn = document.getElementById('addAction');
        if (addBtn) {
            actionsContainer.insertBefore(list, addBtn);
        }
    }
}

// Add function to remove actions
(window as any).removeAction = function (index: number) {
    proposalActions.splice(index, 1);
    updateActionsList();
};

// Make functions available globally
(window as any).loadCouncilData = loadCouncilData;
(window as any).castVote = castVote;
(window as any).addProposal = addProposal;
(window as any).handleVoteChange = handleVoteChange;
(window as any).selectMember = selectMember;
(window as any).closeProposalModal = closeProposalModal;

(window as any).resetView = function () {
    (document.getElementById('councilSelect') as HTMLSelectElement).value = '';
    (document.getElementById('memberSelect') as HTMLSelectElement).innerHTML = '<option value="">Select Member</option>';
    currentCouncil = null;
    currentMember = null;
    updateUIState();
};

// Initialize the test data and page
initializeTestData().then(() => {
    initializeCouncils();
    updateUIState();

    // Set up auto-refresh
    setInterval(updateProposals, 5000); // Update every 5 seconds
});
