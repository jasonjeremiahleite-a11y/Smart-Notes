// Data Management
let notes = JSON.parse(localStorage.getItem('royal-notes') || '[]');
let documents = JSON.parse(localStorage.getItem('royal-documents') || '[]');
let currentNoteId = null;
let currentDocId = null;
let currentCalendarDate = new Date();
let calendarView = 'month';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeNotes();
    initializeDocuments();
    initializeCalendar();
    initializeAIPlanner();
    updateDashboard();
    renderNotes();
    renderDocuments();
    renderCalendar();
});

// Navigation
function initializeNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(targetView).classList.add('active');

            if (targetView === 'calendar') renderCalendar();
            if (targetView === 'archive') renderArchive();
        });
    });
}

// Dashboard
function updateDashboard() {
    const activeNotes = notes.filter(n => !n.archived);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    document.getElementById('total-notes').textContent = activeNotes.length;
    document.getElementById('total-docs').textContent = documents.length;

    const upcoming = activeNotes.filter(n => {
        if (!n.dueDate || n.status === 'completed') return false;
        const due = new Date(n.dueDate);
        return due >= today && due <= nextWeek;
    });
    document.getElementById('upcoming-tasks').textContent = upcoming.length;

    const overdue = activeNotes.filter(n => {
        if (!n.dueDate || n.status === 'completed') return false;
        return new Date(n.dueDate) < today;
    });
    document.getElementById('overdue-tasks').textContent = overdue.length;

    const completed = activeNotes.filter(n => n.status === 'completed');
    document.getElementById('completed-tasks').textContent = completed.length;
}

// Notes System
function initializeNotes() {
    const createCollapsed = document.getElementById('note-create-collapsed');
    const createExpanded = document.getElementById('note-create-expanded');

    createCollapsed.addEventListener('click', () => {
        createCollapsed.style.display = 'none';
        createExpanded.style.display = 'flex';
        document.getElementById('new-note-title').focus();
    });

    document.addEventListener('click', (e) => {
        const noteCreate = document.getElementById('note-create');
        if (!noteCreate.contains(e.target) && createExpanded.style.display === 'flex') {
            saveNewNote();
            createExpanded.style.display = 'none';
            createCollapsed.style.display = 'block';
        }
    });

    // Status buttons in create form
    document.querySelectorAll('#note-create-expanded .status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#note-create-expanded .status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Search
    document.getElementById('search-notes').addEventListener('input', (e) => {
        renderNotes(e.target.value);
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotes();
        });
    });

    // Modal handlers
    initializeNoteModal();
}

function saveNewNote() {
    const title = document.getElementById('new-note-title').value.trim();
    const content = document.getElementById('new-note-content').value.trim();
    const dueDate = document.getElementById('new-note-date').value;
    const isChecklist = document.getElementById('new-note-checklist').checked;
    const activeStatus = document.querySelector('#note-create-expanded .status-btn.active');
    const status = activeStatus ? activeStatus.dataset.status : 'not-started';

    if (!title && !content) return;

    const note = {
        id: Date.now(),
        title: title || 'Untitled',
        content,
        status,
        dueDate: dueDate || null,
        isChecklist,
        checklistItems: [],
        pinned: false,
        archived: false,
        createdAt: new Date().toISOString()
    };

    notes.unshift(note);
    saveNotes();

    // Reset form
    document.getElementById('new-note-title').value = '';
    document.getElementById('new-note-content').value = '';
    document.getElementById('new-note-date').value = '';
    document.getElementById('new-note-checklist').checked = false;
    document.querySelectorAll('#note-create-expanded .status-btn').forEach(b => b.classList.remove('active'));

    renderNotes();
    updateDashboard();
}

function renderNotes(searchTerm = '') {
    const grid = document.getElementById('notes-grid');
    const activeFilter = document.querySelector('.filter-btn.active').dataset.status;

    let filtered = notes.filter(n => !n.archived);

    if (activeFilter !== 'all') {
        filtered = filtered.filter(n => n.status === activeFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(n =>
            n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort: pinned first, then by date
    filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    grid.innerHTML = filtered.map(note => createNoteCard(note)).join('');

    // Add click handlers
    grid.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => openNoteModal(card.dataset.id));
    });
}

function createNoteCard(note) {
    const statusLabels = {
        'completed': 'Completed',
        'in-progress': 'In Progress',
        'not-started': 'Not Started',
        'high-priority': 'High Priority',
        'easy': 'Easy'
    };

    const isOverdue = note.dueDate && new Date(note.dueDate) < new Date() && note.status !== 'completed';

    return `
        <div class="note-card status-${note.status} ${note.pinned ? 'pinned' : ''} ${isOverdue ? 'overdue' : ''}"
             data-id="${note.id}">
            <div class="note-card-header">
                <div class="note-card-title">${note.title}</div>
                <span class="status-badge ${note.status}">${statusLabels[note.status]}</span>
            </div>
            <div class="note-card-content">${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}</div>
            ${note.dueDate ? `
                <div class="note-card-meta">
                    <span class="note-card-date ${isOverdue ? 'overdue-text' : ''}">
                        ${isOverdue ? '⚠️ Overdue: ' : 'Due: '} ${formatDate(note.dueDate)}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

function initializeNoteModal() {
    const modal = document.getElementById('note-modal');
    const closeBtn = document.getElementById('close-note-modal');
    const pinBtn = document.getElementById('pin-note-modal');
    const archiveBtn = document.getElementById('archive-note-modal');
    const deleteBtn = document.getElementById('delete-note-modal');

    closeBtn.addEventListener('click', () => {
        saveCurrentNote();
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            saveCurrentNote();
            modal.classList.remove('active');
        }
    });

    pinBtn.addEventListener('click', () => {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.pinned = !note.pinned;
            saveNotes();
            renderNotes();
        }
    });

    archiveBtn.addEventListener('click', () => {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.archived = true;
            saveNotes();
            modal.classList.remove('active');
            renderNotes();
            updateDashboard();
        }
    });

    deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this note?')) {
            notes = notes.filter(n => n.id !== currentNoteId);
            saveNotes();
            modal.classList.remove('active');
            renderNotes();
            updateDashboard();
        }
    });

    // Status buttons
    document.querySelectorAll('#note-modal .status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#note-modal .status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const note = notes.find(n => n.id === currentNoteId);
            if (note) {
                note.status = btn.dataset.status;
                saveNotes();
                renderNotes();
                updateDashboard();
            }
        });
    });

    // Checklist toggle
    document.getElementById('modal-note-checklist').addEventListener('change', (e) => {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.isChecklist = e.target.checked;
            renderChecklistInModal(note);
            saveNotes();
        }
    });

    // Save button
    document.getElementById('save-note-btn').addEventListener('click', () => {
        saveCurrentNote();
        showSaveConfirmation();
    });
}

function showSaveConfirmation() {
    const confirmation = document.getElementById('save-confirmation');
    confirmation.style.display = 'inline';
    setTimeout(() => {
        confirmation.style.display = 'none';
    }, 2000);
}

function openNoteModal(noteId) {
    currentNoteId = parseInt(noteId);
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    document.getElementById('modal-note-title').value = note.title;
    document.getElementById('modal-note-content').value = note.content;
    document.getElementById('modal-note-date').value = note.dueDate || '';
    document.getElementById('modal-note-checklist').checked = note.isChecklist;

    // Set active status
    document.querySelectorAll('#note-modal .status-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.status === note.status);
    });

    renderChecklistInModal(note);

    document.getElementById('note-modal').classList.add('active');
}

function renderChecklistInModal(note) {
    const container = document.getElementById('modal-checklist-container');
    const contentArea = document.getElementById('modal-note-content');

    if (note.isChecklist) {
        contentArea.style.display = 'none';
        container.style.display = 'block';

        container.innerHTML = `
            <div class="checklist-items">
                ${note.checklistItems.map((item, index) => `
                    <div class="checklist-item ${item.completed ? 'completed' : ''}">
                        <input type="checkbox" ${item.completed ? 'checked' : ''}
                               onchange="toggleChecklistItem(${index})">
                        <input type="text" class="checklist-input" value="${item.text}"
                               onchange="updateChecklistItem(${index}, this.value)">
                    </div>
                `).join('')}
            </div>
            <input type="text" class="checklist-input" placeholder="Press Enter to add item..."
                   onkeypress="if(event.key==='Enter') addChecklistItem(this.value, this)">
        `;
    } else {
        contentArea.style.display = 'block';
        container.style.display = 'none';
    }
}

function addChecklistItem(text, input) {
    if (!text.trim()) return;

    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.checklistItems.push({ text: text.trim(), completed: false });
        input.value = '';
        renderChecklistInModal(note);
        saveNotes();
    }
}

function toggleChecklistItem(index) {
    const note = notes.find(n => n.id === currentNoteId);
    if (note && note.checklistItems[index]) {
        note.checklistItems[index].completed = !note.checklistItems[index].completed;

        // Animate removal
        const item = event.target.closest('.checklist-item');
        if (note.checklistItems[index].completed) {
            item.classList.add('removing');
            setTimeout(() => {
                note.checklistItems.splice(index, 1);

                // Check if all items completed
                if (note.checklistItems.length === 0 || note.checklistItems.every(i => i.completed)) {
                    note.status = 'completed';
                    renderNotes();
                    updateDashboard();
                }

                renderChecklistInModal(note);
                saveNotes();
            }, 300);
        } else {
            saveNotes();
        }
    }
}

function updateChecklistItem(index, text) {
    const note = notes.find(n => n.id === currentNoteId);
    if (note && note.checklistItems[index]) {
        note.checklistItems[index].text = text;
        saveNotes();
    }
}

function saveCurrentNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.title = document.getElementById('modal-note-title').value || 'Untitled';
        note.content = document.getElementById('modal-note-content').value;
        note.dueDate = document.getElementById('modal-note-date').value || null;
        saveNotes();
        renderNotes();
        updateDashboard();
    }
}

function renderArchive() {
    const grid = document.getElementById('archive-grid');
    const archived = notes.filter(n => n.archived);

    if (archived.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No archived notes</p>';
        return;
    }

    grid.innerHTML = archived.map(note => `
        <div class="note-card status-${note.status}" data-id="${note.id}">
            <div class="note-card-header">
                <div class="note-card-title">${note.title}</div>
            </div>
            <div class="note-card-content">${note.content.substring(0, 150)}</div>
            <button class="btn-secondary" onclick="restoreNote(${note.id})">Restore</button>
        </div>
    `).join('');
}

function restoreNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.archived = false;
        saveNotes();
        renderArchive();
        renderNotes();
        updateDashboard();
    }
}

function saveNotes() {
    localStorage.setItem('royal-notes', JSON.stringify(notes));
}

// Documents System
function initializeDocuments() {
    document.getElementById('create-doc-btn').addEventListener('click', createNewDocument);
    document.getElementById('back-to-docs').addEventListener('click', showDocLibrary);

    // Search
    document.getElementById('search-docs').addEventListener('input', (e) => {
        renderDocuments(e.target.value);
    });

    // Editor auto-save
    let saveTimeout;
    document.getElementById('doc-title').addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveCurrentDocument, 1000);
    });

    document.getElementById('doc-content').addEventListener('input', () => {
        clearTimeout(saveTimeout);
        document.getElementById('save-indicator').textContent = 'Saving...';
        saveTimeout = setTimeout(saveCurrentDocument, 1000);
    });

    // Toolbar
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            const value = btn.dataset.value;

            if (value) {
                document.execCommand(command, false, value);
            } else {
                document.execCommand(command);
            }

            document.getElementById('doc-content').focus();
        });
    });
}

function createNewDocument() {
    const doc = {
        id: Date.now(),
        title: 'Untitled Document',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    documents.push(doc);
    saveDocuments();
    openDocument(doc.id);
    updateDashboard();
}

function renderDocuments(searchTerm = '') {
    const grid = document.getElementById('docs-grid');

    let filtered = documents;
    if (searchTerm) {
        filtered = documents.filter(d =>
            d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No documents yet. Create your first document!</p>';
        return;
    }

    grid.innerHTML = filtered.map(doc => `
        <div class="doc-card" data-id="${doc.id}">
            <div class="doc-card-title">${doc.title}</div>
            <div class="doc-card-meta">Last edited: ${formatDate(doc.updatedAt)}</div>
            <div class="doc-card-preview">${stripHtml(doc.content).substring(0, 100)}...</div>
            <div class="doc-card-actions">
                <button class="btn-secondary" onclick="openDocument(${doc.id})">Open</button>
                <button class="btn-secondary" onclick="deleteDocument(${doc.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function openDocument(docId) {
    currentDocId = docId;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('doc-title').value = doc.title;
    document.getElementById('doc-content').innerHTML = doc.content;

    document.getElementById('doc-library').style.display = 'none';
    document.getElementById('doc-editor').style.display = 'block';
}

function showDocLibrary() {
    saveCurrentDocument();
    document.getElementById('doc-editor').style.display = 'none';
    document.getElementById('doc-library').style.display = 'block';
    renderDocuments();
}

function saveCurrentDocument() {
    const doc = documents.find(d => d.id === currentDocId);
    if (doc) {
        doc.title = document.getElementById('doc-title').value || 'Untitled Document';
        doc.content = document.getElementById('doc-content').innerHTML;
        doc.updatedAt = new Date().toISOString();
        saveDocuments();
        document.getElementById('save-indicator').textContent = 'Saved';
    }
}

function deleteDocument(docId) {
    if (confirm('Delete this document?')) {
        documents = documents.filter(d => d.id !== docId);
        saveDocuments();
        renderDocuments();
        updateDashboard();
    }
}

function saveDocuments() {
    localStorage.setItem('royal-documents', JSON.stringify(documents));
}

// Calendar System
function initializeCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            calendarView = btn.dataset.calView;
            renderCalendar();
        });
    });
}

function renderCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const display = document.getElementById('calendar-display');

    monthYear.textContent = currentCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    if (calendarView === 'month') {
        renderMonthView(display);
    } else {
        renderWeekView(display);
    }
}

function renderMonthView(container) {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let html = '<div class="calendar-grid">';

    // Headers
    days.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });

    // Days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        const isToday = currentDate.getTime() === today.getTime();
        const isOtherMonth = currentDate.getMonth() !== month;

        const dayNotes = notes.filter(n => {
            if (!n.dueDate || n.archived) return false;
            const noteDate = new Date(n.dueDate);
            noteDate.setHours(0, 0, 0, 0);
            return noteDate.getTime() === currentDate.getTime();
        });

        const statusIcons = {
            'high-priority': '🔴',
            'in-progress': '🟢',
            'not-started': '⚪',
            'easy': '🟤',
            'completed': '🟡'
        };

        const visibleTasks = dayNotes.slice(0, 3);
        const remainingCount = dayNotes.length - 3;

        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isOtherMonth ? 'other-month' : ''}">
                <div class="day-number">${currentDate.getDate()}</div>
                <div class="day-task-list">
                    ${visibleTasks.map(n => `
                        <div class="calendar-task ${n.status}" onclick="event.stopPropagation(); openNoteModal(${n.id})">
                            <span class="task-icon">${statusIcons[n.status]}</span>
                            <span class="task-name">${n.title}</span>
                        </div>
                    `).join('')}
                    ${remainingCount > 0 ? `
                        <div class="more-tasks" onclick="event.stopPropagation(); showDayTasks('${currentDate.toISOString()}')">
                            +${remainingCount} more
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderWeekView(container) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let html = '<div class="week-view">';

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
        currentDate.setHours(0, 0, 0, 0);

        const dayNotes = notes.filter(n => {
            if (!n.dueDate || n.archived) return false;
            const noteDate = new Date(n.dueDate);
            noteDate.setHours(0, 0, 0, 0);
            return noteDate.getTime() === currentDate.getTime();
        });

        html += `
            <div class="week-day">
                <div class="week-day-header">${days[i]} - ${formatDate(currentDate.toISOString())}</div>
                <div class="week-day-tasks">
                    ${dayNotes.length === 0 ? '<p style="color: var(--text-secondary);">No tasks scheduled</p>' : ''}
                    ${dayNotes.map(n => `
                        <div class="week-task-item ${n.status}" onclick="openNoteModal(${n.id})">
                            <strong>${n.title}</strong>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${n.content.substring(0, 80)}...
                            </p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function showDayTasks(dateStr) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    const dayNotes = notes.filter(n => {
        if (!n.dueDate || n.archived) return false;
        const noteDate = new Date(n.dueDate);
        noteDate.setHours(0, 0, 0, 0);
        return noteDate.getTime() === date.getTime();
    });

    if (dayNotes.length > 0) {
        openNoteModal(dayNotes[0].id);
    }
}

// AI Planner System
function initializeAIPlanner() {
    document.getElementById('generate-plan').addEventListener('click', generateAIPlan);

    // Auto-generate on Saturdays
    const today = new Date();
    const lastGenerated = localStorage.getItem('last-ai-plan-date');
    if (!lastGenerated || new Date(lastGenerated).toDateString() !== today.toDateString()) {
        if (today.getDay() === 6) { // Saturday
            generateAIPlan();
        }
    }

    renderAIPlan();
}

function generateAIPlan() {
    // Get TODAY dynamically - ALWAYS current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // STRICT RULE: Only include tasks that are NOT completed
    const activeTasks = notes.filter(n => {
        if (n.archived || n.status === 'completed' || !n.dueDate) {
            return false;
        }
        return true;
    });

    if (activeTasks.length === 0) {
        document.getElementById('ai-plan-display').innerHTML =
            '<p style="text-align: center; color: var(--text-secondary);">No tasks with due dates to plan. Add some tasks first!</p>';
        return;
    }

    // Calculate study session durations
    const getSessionDuration = (status) => {
        if (status === 'high-priority') return 2; // 2 hours
        if (status === 'in-progress') return 1.5; // 1.5 hours
        if (status === 'easy') return 0.75; // 45 minutes
        return 1; // 1 hour default
    };

    // Sort by: 1) Overdue first, 2) Closest deadline, 3) Priority (hardest first)
    activeTasks.sort((a, b) => {
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        dateA.setHours(0, 0, 0, 0);
        dateB.setHours(0, 0, 0, 0);

        const isOverdueA = dateA < today;
        const isOverdueB = dateB < today;

        // Overdue tasks come FIRST
        if (isOverdueA && !isOverdueB) return -1;
        if (!isOverdueA && isOverdueB) return 1;

        // Then by closest deadline
        const deadlineDiff = dateA - dateB;
        if (Math.abs(deadlineDiff) > 0) return deadlineDiff;

        // Then by priority (hardest first)
        const priorityOrder = { 'high-priority': 0, 'in-progress': 1, 'not-started': 2, 'easy': 3 };
        return priorityOrder[a.status] - priorityOrder[b.status];
    });

    // Assign session info to tasks
    activeTasks.forEach(task => {
        task.sessionDuration = getSessionDuration(task.status);
        task.isHeavy = task.status === 'high-priority' || task.status === 'in-progress';
    });

    // Generate plan for next 7 days starting from TODAY
    const weekPlan = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let usedTasks = new Set();
    let consecutiveWorkDays = 0;

    // Determine if we need rest days based on workload
    const totalTasks = activeTasks.length;
    const urgentTasks = activeTasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today || t.status === 'high-priority';
    }).length;

    // If many deadlines exist, reduce rest days
    const allowRestDays = urgentTasks < 5 && totalTasks < 10;

    for (let i = 0; i < 7; i++) {
        const planDate = new Date(today);
        planDate.setDate(today.getDate() + i);
        const dayName = days[planDate.getDay()];
        const dateStr = planDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Determine if this should be a rest day
        // Rules: Max 1 rest day after every 2 work days
        const shouldRest = allowRestDays &&
                          consecutiveWorkDays >= 2 &&
                          usedTasks.size < activeTasks.length &&
                          i > 0; // Never rest on first day

        if (shouldRest && Math.random() > 0.5) {
            weekPlan.push({
                day: dayName,
                date: dateStr,
                tasks: [],
                isRestDay: true
            });
            consecutiveWorkDays = 0;
            continue;
        }

        // Build daily task list
        const dayTasks = [];
        let heavyCount = 0;
        let totalHours = 0;
        const maxDailyHours = 4; // Maximum 4 hours of study per day

        for (let task of activeTasks) {
            // Skip if already scheduled
            if (usedTasks.has(task.id)) continue;

            // Check if adding this task exceeds limits
            if (task.isHeavy && heavyCount >= 2) continue; // Max 2 heavy sessions
            if (totalHours + task.sessionDuration > maxDailyHours) continue;

            // For first day (today), prioritize overdue tasks
            const taskDueDate = new Date(task.dueDate);
            taskDueDate.setHours(0, 0, 0, 0);
            const isOverdue = taskDueDate < today;

            if (i === 0 && isOverdue) {
                dayTasks.push(task);
                usedTasks.add(task.id);
                if (task.isHeavy) heavyCount++;
                totalHours += task.sessionDuration;
            } else if (i > 0 || !isOverdue) {
                // Regular scheduling for other days
                if (dayTasks.length < 3) {
                    dayTasks.push(task);
                    usedTasks.add(task.id);
                    if (task.isHeavy) heavyCount++;
                    totalHours += task.sessionDuration;
                }
            }

            // Stop if we have enough tasks for the day
            if (dayTasks.length >= 3 || totalHours >= maxDailyHours) break;
        }

        weekPlan.push({
            day: dayName,
            date: dateStr,
            tasks: dayTasks,
            isRestDay: false,
            totalHours: totalHours.toFixed(1)
        });

        if (dayTasks.length > 0) {
            consecutiveWorkDays++;
        } else {
            consecutiveWorkDays = 0;
        }
    }

    localStorage.setItem('ai-weekly-plan', JSON.stringify(weekPlan));
    localStorage.setItem('last-ai-plan-date', today.toISOString());

    renderAIPlan();
}

function renderAIPlan() {
    const container = document.getElementById('ai-plan-display');
    const lastGenerated = localStorage.getItem('last-ai-plan-date');
    const planData = JSON.parse(localStorage.getItem('ai-weekly-plan') || '[]');

    if (lastGenerated) {
        document.getElementById('last-generated').textContent =
            `Last generated: ${formatDate(lastGenerated)}`;
    }

    if (planData.length === 0) {
        container.innerHTML =
            '<p style="text-align: center; color: var(--text-secondary);">Click "Generate Weekly Plan" to create your AI study schedule</p>';
        return;
    }

    const difficultyMap = {
        'high-priority': 'hard',
        'in-progress': 'medium',
        'easy': 'easy',
        'not-started': 'medium'
    };

    container.innerHTML = planData.map(day => `
        <div class="ai-day-plan ${day.isRestDay ? 'rest-day' : ''}">
            <div class="ai-day-header">
                ${day.day} - ${day.date}
                ${day.totalHours ? `<span class="study-hours">${day.totalHours}h study</span>` : ''}
            </div>
            <div class="ai-task-list">
                ${day.isRestDay ?
                    '<p style="color: var(--gold);">🌟 Rest Day - Light review or catch up on easy tasks</p>' :
                    day.tasks.length === 0 ?
                        '<p style="color: var(--text-secondary);">No tasks scheduled - Free day!</p>' :
                        day.tasks.map(task => {
                            const sessionDuration = task.sessionDuration || 1;
                            const dueDate = new Date(task.dueDate);
                            dueDate.setHours(0, 0, 0, 0);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isOverdue = dueDate < today;

                            return `
                                <div class="ai-task-item ${difficultyMap[task.status]}" onclick="openNoteModal(${task.id})">
                                    <div class="ai-task-title">
                                        ${isOverdue ? '⚠️ ' : ''}${task.title}
                                        <span class="session-duration">${sessionDuration}h session</span>
                                    </div>
                                    <div class="ai-task-description">
                                        Due: ${formatDate(task.dueDate)} ${isOverdue ? '(OVERDUE)' : ''} |
                                        Priority: ${task.status.replace('-', ' ').toUpperCase()}
                                    </div>
                                </div>
                            `;
                        }).join('')
                }
            </div>
        </div>
    `).join('');
}

// Utility Functions
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Make functions globally accessible
window.restoreNote = restoreNote;
window.openDocument = openDocument;
window.deleteDocument = deleteDocument;
window.showDayTasks = showDayTasks;
window.openNoteModal = openNoteModal;
window.addChecklistItem = addChecklistItem;
window.toggleChecklistItem = toggleChecklistItem;
window.updateChecklistItem = updateChecklistItem;